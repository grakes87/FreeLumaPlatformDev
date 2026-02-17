import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  User,
  VerseCategoryContent,
  VerseCategoryContentTranslation,
  VerseCategory,
  VerseCategoryMedia,
  VerseCategoryReaction,
  VerseCategoryComment,
  sequelize,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op, fn, col } from 'sequelize';

export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      // Fetch user to check mode and verse_mode
      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'mode', 'verse_mode'],
      });

      if (!user) {
        return errorResponse('User not found', 404);
      }

      if (user.mode !== 'bible') {
        return errorResponse('Verse by category is only available in Bible mode', 403);
      }

      const { searchParams } = new URL(req.url);
      const categoryIdParam = searchParams.get('category_id');
      const excludeParam = searchParams.get('exclude');
      const translationParam = searchParams.get('translation');

      // Build WHERE clause for verse
      const where: Record<string, unknown> = {};

      // Category filter
      if (categoryIdParam && categoryIdParam !== 'all') {
        const categoryId = parseInt(categoryIdParam, 10);
        if (isNaN(categoryId)) {
          return errorResponse('Invalid category_id');
        }
        where.category_id = categoryId;
      }

      // Exclude recently shown IDs (max 10)
      if (excludeParam) {
        const excludeIds = excludeParam
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id))
          .slice(0, 10);

        if (excludeIds.length > 0) {
          where.id = { [Op.notIn]: excludeIds };
        }
      }

      // Fetch one random verse with translations and category
      let verse = await VerseCategoryContent.findOne({
        where,
        include: [
          {
            model: VerseCategoryContentTranslation,
            as: 'translations',
          },
          {
            model: VerseCategory,
            as: 'category',
            attributes: ['id', 'name', 'slug'],
          },
        ],
        order: sequelize.random(),
      });

      // Fallback: if no verse found with exclusion, retry without exclusion
      if (!verse && where.id) {
        delete where.id;
        verse = await VerseCategoryContent.findOne({
          where,
          include: [
            {
              model: VerseCategoryContentTranslation,
              as: 'translations',
            },
            {
              model: VerseCategory,
              as: 'category',
              attributes: ['id', 'name', 'slug'],
            },
          ],
          order: sequelize.random(),
        });
      }

      if (!verse) {
        return errorResponse('No verses found', 404);
      }

      // Fetch random background image (category-specific or global)
      const media = await VerseCategoryMedia.findOne({
        where: {
          [Op.or]: [
            { category_id: verse.category_id },
            { category_id: null },
          ],
        },
        order: sequelize.random(),
      });

      // Get user's existing reaction on this verse
      const existingReaction = await VerseCategoryReaction.findOne({
        where: {
          user_id: context.user.id,
          verse_category_content_id: verse.id,
        },
        attributes: ['reaction_type'],
      });

      // Get comment count for this verse
      const commentCount = await VerseCategoryComment.count({
        where: { verse_category_content_id: verse.id },
      });

      // Get reaction counts
      const reactionRows = await VerseCategoryReaction.findAll({
        where: { verse_category_content_id: verse.id },
        attributes: [
          'reaction_type',
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['reaction_type'],
        raw: true,
      }) as unknown as { reaction_type: string; count: string }[];

      const reactionCounts: Record<string, number> = {};
      let totalReactions = 0;
      for (const row of reactionRows) {
        const c = parseInt(row.count, 10);
        reactionCounts[row.reaction_type] = c;
        totalReactions += c;
      }

      const verseJSON = verse.toJSON() as unknown as Record<string, unknown>;

      // Fire-and-forget trackActivity for verse engagement (uses daily_view activity type)
      import('@/lib/streaks/tracker').then(({ trackActivity }) => {
        trackActivity(context.user.id, 'daily_view').catch(() => {});
      });

      return successResponse({
        verse: {
          id: verseJSON.id,
          category_id: verseJSON.category_id,
          verse_reference: verseJSON.verse_reference,
          content_text: verseJSON.content_text,
          book: verseJSON.book,
          category: verseJSON.category,
          translations: verseJSON.translations,
        },
        background_url: media?.media_url ?? null,
        user_reaction: existingReaction?.reaction_type ?? null,
        reaction_counts: reactionCounts,
        reaction_total: totalReactions,
        comment_count: commentCount,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch verse');
    }
  }
);
