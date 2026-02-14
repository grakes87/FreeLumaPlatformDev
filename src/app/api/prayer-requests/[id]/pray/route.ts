import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  sequelize,
  Post,
  PrayerRequest,
  PrayerSupport,
  User,
} from '@/lib/db/models';
import { getBlockedUserIds } from '@/lib/utils/blocks';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * POST /api/prayer-requests/[id]/pray - Toggle pray for a prayer request
 *
 * Uses a sequelize transaction to atomically create/destroy PrayerSupport
 * and increment/decrement the pray_count on the PrayerRequest.
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;
      const params = await context.params;
      const prayerRequestId = parseInt(params.id);

      if (isNaN(prayerRequestId)) {
        return errorResponse('Invalid prayer request ID');
      }

      // Check bible-mode restriction
      const user = await User.findByPk(userId, { attributes: ['id', 'mode'] });
      if (!user) {
        return errorResponse('User not found', 404);
      }
      if (user.mode === 'positivity') {
        return errorResponse('Prayer wall is available in Bible mode', 403);
      }

      // Find the prayer request
      const prayerRequest = await PrayerRequest.findByPk(prayerRequestId, {
        include: [
          {
            model: Post,
            as: 'post',
            where: { deleted_at: null },
            attributes: ['id', 'user_id'],
          },
        ],
      });

      if (!prayerRequest) {
        return errorResponse('Prayer request not found', 404);
      }

      const post = (prayerRequest as unknown as Record<string, unknown>).post as Post;
      if (!post) {
        return errorResponse('Prayer request not found', 404);
      }

      // Block check
      const blockedIds = await getBlockedUserIds(userId);
      if (blockedIds.has(post.user_id)) {
        return errorResponse('Prayer request not found', 404);
      }

      // Cannot pray for own prayer request (optional rule, but reasonable)
      // Actually, users should be allowed to pray for their own requests
      // No self-pray restriction per plan

      // Atomic transaction: toggle pray support + update count
      const result = await sequelize.transaction(async (t) => {
        const existingSupport = await PrayerSupport.findOne({
          where: {
            user_id: userId,
            prayer_request_id: prayerRequestId,
          },
          transaction: t,
        });

        if (existingSupport) {
          // Remove pray support
          await existingSupport.destroy({ transaction: t });
          await prayerRequest.decrement('pray_count', { transaction: t });
          await prayerRequest.reload({ transaction: t });

          return {
            action: 'removed' as const,
            pray_count: prayerRequest.pray_count,
          };
        } else {
          // Add pray support
          await PrayerSupport.create(
            {
              user_id: userId,
              prayer_request_id: prayerRequestId,
            },
            { transaction: t }
          );
          await prayerRequest.increment('pray_count', { transaction: t });
          await prayerRequest.reload({ transaction: t });

          return {
            action: 'added' as const,
            pray_count: prayerRequest.pray_count,
            post_user_id: post.user_id,
          };
        }
      });

      // Fire-and-forget: track social activity for pray action
      if (result.action === 'added') {
        import('@/lib/streaks/tracker').then(({ trackActivity }) => {
          trackActivity(userId, 'social_activity').catch(() => {});
        }).catch(() => {});
      }

      // Create notification for prayer request author when someone prays
      if (result.action === 'added' && result.post_user_id !== userId) {
        try {
          const { createNotification } = await import('@/lib/notifications/create');
          const { NotificationType, NotificationEntityType } = await import('@/lib/notifications/types');
          await createNotification({
            recipient_id: result.post_user_id,
            actor_id: userId,
            type: NotificationType.PRAYER,
            entity_type: NotificationEntityType.PRAYER_REQUEST,
            entity_id: prayerRequestId,
            preview_text: 'prayed for your prayer request',
          });
        } catch {
          // Non-fatal
        }
      }

      return successResponse({
        action: result.action,
        pray_count: result.pray_count,
      });
    } catch (error) {
      return serverError(error, 'Failed to toggle prayer support');
    }
  }
);
