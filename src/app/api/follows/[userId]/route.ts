import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';

/**
 * POST /api/follows/[userId] - Follow a user
 */
export const POST = withAuth(async (_req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const targetId = parseInt(params.userId, 10);

    if (isNaN(targetId)) {
      return errorResponse('Invalid user ID', 400);
    }

    const userId = context.user.id;

    // Prevent self-follow
    if (targetId === userId) {
      return errorResponse('You cannot follow yourself', 400);
    }

    const { User, Follow, Block, PlatformSetting } = await import('@/lib/db/models');

    // Check target user exists
    const targetUser = await User.findByPk(targetId, {
      attributes: ['id', 'profile_privacy', 'mode'],
    });

    if (!targetUser) {
      return errorResponse('User not found', 404);
    }

    // Check blocks (either direction)
    const block = await Block.findOne({
      where: {
        [Op.or]: [
          { blocker_id: userId, blocked_id: targetId },
          { blocker_id: targetId, blocked_id: userId },
        ],
      },
    });

    if (block) {
      return errorResponse('Unable to follow this user', 403);
    }

    // Check mode isolation
    const modeIsolation = await PlatformSetting.get('mode_isolation_social');
    if (modeIsolation === 'true') {
      const currentUser = await User.findByPk(userId, {
        attributes: ['mode'],
      });
      if (currentUser && currentUser.mode !== targetUser.mode) {
        return errorResponse('Cannot follow users in a different mode', 403);
      }
    }

    // Check existing follow
    const existing = await Follow.findOne({
      where: { follower_id: userId, following_id: targetId },
    });

    if (existing) {
      return errorResponse(
        existing.status === 'pending'
          ? 'Follow request already sent'
          : 'Already following this user',
        409
      );
    }

    // Create follow: public profiles -> active, private -> pending
    const status = targetUser.profile_privacy === 'public' ? 'active' : 'pending';

    const follow = await Follow.create({
      follower_id: userId,
      following_id: targetId,
      status,
    });

    // Create notification for follow or follow request
    try {
      const { createNotification } = await import('@/lib/notifications/create');
      const { NotificationType, NotificationEntityType } = await import('@/lib/notifications/types');
      await createNotification({
        recipient_id: targetId,
        actor_id: userId,
        type: status === 'active' ? NotificationType.FOLLOW : NotificationType.FOLLOW_REQUEST,
        entity_type: NotificationEntityType.FOLLOW,
        entity_id: follow.id,
        preview_text: status === 'active' ? 'started following you' : 'sent you a follow request',
      });
    } catch {
      // Non-fatal: notification failure should not block the follow action
    }

    return successResponse({ status: follow.status, following_id: follow.id }, 201);
  } catch (error) {
    return serverError(error, 'Failed to follow user');
  }
});

/**
 * DELETE /api/follows/[userId] - Unfollow a user or cancel pending request
 */
export const DELETE = withAuth(async (_req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const targetId = parseInt(params.userId, 10);

    if (isNaN(targetId)) {
      return errorResponse('Invalid user ID', 400);
    }

    const { Follow } = await import('@/lib/db/models');

    const follow = await Follow.findOne({
      where: {
        follower_id: context.user.id,
        following_id: targetId,
      },
    });

    if (!follow) {
      return errorResponse('Not following this user', 404);
    }

    await follow.destroy();

    return successResponse({ unfollowed: true });
  } catch (error) {
    return serverError(error, 'Failed to unfollow user');
  }
});
