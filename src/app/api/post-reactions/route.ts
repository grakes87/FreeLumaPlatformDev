import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { PostReaction, Post } from '@/lib/db/models';
import { REACTION_TYPES } from '@/lib/utils/constants';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { fn, col } from 'sequelize';

const reactionSchema = z.object({
  post_id: z.number().int().positive(),
  reaction_type: z.enum(REACTION_TYPES),
});

export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const postId = parseInt(searchParams.get('post_id') || '', 10);

      if (!postId || isNaN(postId)) {
        return errorResponse('post_id is required');
      }

      // Get reaction counts grouped by type
      const rows = await PostReaction.findAll({
        where: { post_id: postId },
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
      const existing = await PostReaction.findOne({
        where: {
          user_id: context.user.id,
          post_id: postId,
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
      return serverError(error, 'Failed to fetch post reactions');
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

      const { post_id, reaction_type } = parsed.data;
      const user_id = context.user.id;

      const existing = await PostReaction.findOne({
        where: { user_id, post_id },
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

      // No existing reaction -- create
      await PostReaction.create({ user_id, post_id, reaction_type });

      // Create notification for post owner
      try {
        const post = await Post.findByPk(post_id, { attributes: ['id', 'user_id'] });
        if (post && post.user_id !== user_id) {
          const { createNotification } = await import('@/lib/notifications/create');
          const { NotificationType, NotificationEntityType } = await import('@/lib/notifications/types');
          await createNotification({
            recipient_id: post.user_id,
            actor_id: user_id,
            type: NotificationType.REACTION,
            entity_type: NotificationEntityType.POST,
            entity_id: post_id,
            preview_text: `reacted ${reaction_type} to your post`,
          });
        }
      } catch {
        // Non-fatal
      }

      return successResponse({ action: 'created', reaction_type });
    } catch (error) {
      return serverError(error, 'Failed to toggle post reaction');
    }
  }
);
