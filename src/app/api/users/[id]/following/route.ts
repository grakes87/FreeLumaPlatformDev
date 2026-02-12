import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';

/**
 * GET /api/users/[id]/following - Get users that a user follows
 *
 * Privacy: private profiles only show following list to the owner.
 * Block filtering: hides blocked/blocking users.
 * Cursor pagination via ?cursor=&limit=
 */
export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const targetId = parseInt(params.id, 10);

    if (isNaN(targetId)) {
      return errorResponse('Invalid user ID', 400);
    }

    const { User, Follow, Block } = await import('@/lib/db/models');

    // Check target user exists and get privacy setting
    const targetUser = await User.findByPk(targetId, {
      attributes: ['id', 'profile_privacy'],
    });

    if (!targetUser) {
      return errorResponse('User not found', 404);
    }

    // Private profiles: only the owner can see following list
    if (targetUser.profile_privacy === 'private' && targetId !== context.user.id) {
      return errorResponse('This user\'s following list is private', 403);
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    // Get blocked user IDs to exclude
    const blocks = await Block.findAll({
      where: {
        [Op.or]: [
          { blocker_id: context.user.id },
          { blocked_id: context.user.id },
        ],
      },
      attributes: ['blocker_id', 'blocked_id'],
      raw: true,
    });

    const blockedIds = new Set<number>();
    for (const b of blocks) {
      if (b.blocker_id !== context.user.id) blockedIds.add(b.blocker_id);
      if (b.blocked_id !== context.user.id) blockedIds.add(b.blocked_id);
    }

    const where: Record<string, unknown> = {
      follower_id: targetId,
      status: 'active',
    };

    if (cursor) {
      where.id = { [Op.lt]: parseInt(cursor, 10) };
    }

    if (blockedIds.size > 0) {
      where.following_id = { [Op.notIn]: Array.from(blockedIds) };
    }

    const following = await Follow.findAll({
      where,
      include: [
        {
          model: User,
          as: 'followedUser',
          attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color', 'bio'],
        },
      ],
      order: [['id', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = following.length > limit;
    const items = hasMore ? following.slice(0, limit) : following;
    const nextCursor = hasMore ? items[items.length - 1].id.toString() : null;

    return successResponse({
      following: items,
      next_cursor: nextCursor,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch following list');
  }
});
