import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { PostCommentReaction } from '@/lib/db/models';
import { REACTION_TYPES } from '@/lib/utils/constants';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { fn, col } from 'sequelize';

const reactionSchema = z.object({
  comment_id: z.number().int().positive(),
  reaction_type: z.enum(REACTION_TYPES),
});

export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const commentId = parseInt(searchParams.get('comment_id') || '', 10);

      if (!commentId || isNaN(commentId)) {
        return errorResponse('comment_id is required');
      }

      // Get reaction counts grouped by type
      const rows = await PostCommentReaction.findAll({
        where: { comment_id: commentId },
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

      // Get user's own reaction
      let userReaction: string | null = null;
      const existing = await PostCommentReaction.findOne({
        where: {
          user_id: context.user.id,
          comment_id: commentId,
        },
        attributes: ['reaction_type'],
      });
      userReaction = existing?.reaction_type ?? null;

      return successResponse({
        counts,
        total,
        user_reaction: userReaction,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch comment reactions');
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

      const { comment_id, reaction_type } = parsed.data;
      const user_id = context.user.id;

      const existing = await PostCommentReaction.findOne({
        where: { user_id, comment_id },
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
      await PostCommentReaction.create({ user_id, comment_id, reaction_type });
      return successResponse({ action: 'created', reaction_type });
    } catch (error) {
      return serverError(error, 'Failed to toggle comment reaction');
    }
  }
);
