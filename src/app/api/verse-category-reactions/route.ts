import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { VerseCategoryReaction, VerseCategoryComment } from '@/lib/db/models';
import { DAILY_REACTION_TYPES } from '@/lib/utils/constants';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { fn, col } from 'sequelize';

const reactionSchema = z.object({
  verse_category_content_id: z.number().int().positive(),
  reaction_type: z.enum(DAILY_REACTION_TYPES as unknown as [string, ...string[]]),
});

export const GET = withOptionalAuth(
  async (req: NextRequest, context: OptionalAuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const contentId = parseInt(searchParams.get('verse_category_content_id') || '', 10);

      if (!contentId || isNaN(contentId)) {
        return errorResponse('verse_category_content_id is required');
      }

      // Get reaction counts grouped by type
      const rows = await VerseCategoryReaction.findAll({
        where: { verse_category_content_id: contentId },
        attributes: [
          'reaction_type',
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['reaction_type'],
        raw: true,
      }) as unknown as { reaction_type: string; count: string }[];

      const counts: Record<string, number> = {};
      let total = 0;
      for (const row of rows) {
        const c = parseInt(row.count, 10);
        counts[row.reaction_type] = c;
        total += c;
      }

      // Get comment count
      const commentCount = await VerseCategoryComment.count({
        where: { verse_category_content_id: contentId },
      });

      // Get user's own reaction if authenticated
      let userReaction: string | null = null;
      if (context.user) {
        const existing = await VerseCategoryReaction.findOne({
          where: {
            user_id: context.user.id,
            verse_category_content_id: contentId,
          },
          attributes: ['reaction_type'],
        });
        userReaction = existing?.reaction_type ?? null;
      }

      return successResponse({
        counts,
        total,
        user_reaction: userReaction,
        comment_count: commentCount,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch reactions');
    }
  }
);

export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const body = await req.json();
      const parsed = reactionSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { verse_category_content_id, reaction_type } = parsed.data;
      const user_id = context.user.id;

      const existing = await VerseCategoryReaction.findOne({
        where: { user_id, verse_category_content_id },
      });

      if (existing) {
        if (existing.reaction_type === reaction_type) {
          // Same type -- toggle off (remove)
          await existing.destroy();
          return successResponse({ action: 'removed', reaction_type: null });
        } else {
          // Different type -- update
          await existing.update({ reaction_type: reaction_type as 'like' | 'love' | 'wow' | 'sad' | 'pray' });
          return successResponse({ action: 'updated', reaction_type });
        }
      }

      // No existing reaction -- create
      await VerseCategoryReaction.create({
        user_id,
        verse_category_content_id,
        reaction_type: reaction_type as 'like' | 'love' | 'wow' | 'sad' | 'pray',
      });

      // Fire-and-forget trackActivity
      import('@/lib/streaks/tracker').then(({ trackActivity }) => {
        trackActivity(user_id, 'social_activity').catch(() => {});
      });

      return successResponse({ action: 'created', reaction_type });
    } catch (error) {
      return serverError(error, 'Failed to toggle reaction');
    }
  }
);
