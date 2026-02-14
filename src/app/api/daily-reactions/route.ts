import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { DailyReaction, DailyComment } from '@/lib/db/models';
import { REACTION_TYPES } from '@/lib/utils/constants';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { fn, col } from 'sequelize';

const reactionSchema = z.object({
  daily_content_id: z.number().int().positive(),
  reaction_type: z.enum(REACTION_TYPES),
});

export const GET = withOptionalAuth(
  async (req: NextRequest, context: OptionalAuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const dailyContentId = parseInt(searchParams.get('daily_content_id') || '', 10);

      if (!dailyContentId || isNaN(dailyContentId)) {
        return errorResponse('daily_content_id is required');
      }

      // Get reaction counts grouped by type
      const rows = await DailyReaction.findAll({
        where: { daily_content_id: dailyContentId },
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
      const commentCount = await DailyComment.count({
        where: { daily_content_id: dailyContentId },
      });

      // Get user's own reaction if authenticated
      let userReaction: string | null = null;
      if (context.user) {
        const existing = await DailyReaction.findOne({
          where: {
            user_id: context.user.id,
            daily_content_id: dailyContentId,
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

      const { daily_content_id, reaction_type } = parsed.data;
      const user_id = context.user.id;

      const existing = await DailyReaction.findOne({
        where: { user_id, daily_content_id },
      });

      if (existing) {
        if (existing.reaction_type === reaction_type) {
          // Same type — toggle off (remove)
          await existing.destroy();
          return successResponse({ action: 'removed', reaction_type: null });
        } else {
          // Different type — update
          await existing.update({ reaction_type });
          return successResponse({ action: 'updated', reaction_type });
        }
      }

      // No existing reaction — create
      await DailyReaction.create({ user_id, daily_content_id, reaction_type });
      return successResponse({ action: 'created', reaction_type });
    } catch (error) {
      return serverError(error, 'Failed to toggle reaction');
    }
  }
);
