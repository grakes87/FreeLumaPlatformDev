import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Block,
  Follow,
  User,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const toggleBlockSchema = z.object({
  user_id: z.number().int().positive(),
});

/**
 * GET /api/blocks — List blocked users
 */
export const GET = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const blocks = await Block.findAll({
        where: { blocker_id: context.user.id },
        include: [
          {
            model: User,
            as: 'blockedUser',
            attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      return successResponse({
        blocked_users: blocks.map((b) => (b as unknown as { blockedUser: unknown }).blockedUser),
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch blocked users');
    }
  }
);

/**
 * POST /api/blocks — Toggle block/unblock
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const json = await req.json();
      const parsed = toggleBlockSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { user_id: targetId } = parsed.data;
      const userId = context.user.id;

      // Prevent self-block
      if (targetId === userId) {
        return errorResponse('Cannot block yourself', 400);
      }

      // Verify target user exists
      const targetUser = await User.findByPk(targetId, { attributes: ['id'] });
      if (!targetUser) {
        return errorResponse('User not found', 404);
      }

      // Check if block exists
      const existing = await Block.findOne({
        where: { blocker_id: userId, blocked_id: targetId },
      });

      if (existing) {
        // Unblock
        await existing.destroy();
        return successResponse({ action: 'unblocked' });
      }

      // Create block
      await Block.create({
        blocker_id: userId,
        blocked_id: targetId,
      });

      // Auto-unfollow both directions
      await Follow.destroy({
        where: {
          [Op.or]: [
            { follower_id: userId, following_id: targetId },
            { follower_id: targetId, following_id: userId },
          ],
        },
      });

      return successResponse({ action: 'blocked' });
    } catch (error) {
      return serverError(error, 'Failed to toggle block');
    }
  }
);
