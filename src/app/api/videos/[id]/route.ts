import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { fn, col, Op } from 'sequelize';

const updateVideoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  category_id: z.number().int().positive().optional(),
  video_url: z.string().url().optional(),
  duration_seconds: z.number().int().min(0).optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  caption_url: z.string().url().nullable().optional(),
  is_hero: z.boolean().optional(),
  published: z.boolean().optional(),
  published_at: z.string().datetime().nullable().optional(),
});

/**
 * GET /api/videos/[id] — Get video detail with user-specific progress and reactions
 */
export const GET = withOptionalAuth(
  async (_req: NextRequest, context: OptionalAuthContext) => {
    try {
      const {
        Video,
        VideoCategory,
        VideoProgress,
        VideoReaction,
        User,
      } = await import('@/lib/db/models');

      const params = await context.params;
      const videoId = parseInt(params.id, 10);
      if (isNaN(videoId)) {
        return errorResponse('Invalid video ID');
      }

      const userId = context.user?.id ?? null;

      // Check if user is admin
      let isAdmin = false;
      if (userId) {
        const adminUser = await User.findByPk(userId, { attributes: ['id', 'is_admin'] });
        isAdmin = adminUser?.is_admin === true;
      }

      const video = await Video.findByPk(videoId, {
        include: [
          {
            model: VideoCategory,
            as: 'category',
            attributes: ['id', 'name', 'slug'],
          },
        ],
      });

      if (!video) {
        return errorResponse('Video not found', 404);
      }

      // Non-admin users cannot see unpublished or future-scheduled videos
      if (!isAdmin) {
        const isLive = video.published && (!video.published_at || video.published_at <= new Date());
        if (!isLive) {
          return errorResponse('Video not found', 404);
        }
      }

      // Get user's progress (only for logged-in users)
      let userProgress = null;
      let userReaction = null;
      if (userId) {
        userProgress = await VideoProgress.findOne({
          where: { user_id: userId, video_id: videoId },
          attributes: ['watched_seconds', 'last_position', 'duration_seconds', 'completed'],
        });

        userReaction = await VideoReaction.findOne({
          where: { user_id: userId, video_id: videoId },
          attributes: ['reaction_type'],
        });
      }

      // Get reaction counts by type
      const reactionRows = await VideoReaction.findAll({
        where: { video_id: videoId },
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

      // Increment view_count fire-and-forget
      Video.increment('view_count', { where: { id: videoId } }).catch(() => {
        // Silently ignore view count increment failures
      });

      const videoData = video.toJSON();

      return successResponse({
        ...videoData,
        progress: userProgress
          ? {
              watched_seconds: userProgress.watched_seconds,
              last_position: userProgress.last_position,
              duration_seconds: userProgress.duration_seconds,
              completed: userProgress.completed,
            }
          : null,
        user_reaction: userReaction?.reaction_type ?? null,
        reaction_counts: reactionCounts,
        total_reactions: totalReactions,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch video');
    }
  }
);

/**
 * PUT /api/videos/[id] — Admin update a video
 */
export const PUT = withAdmin(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { Video, VideoCategory } = await import('@/lib/db/models');

      const params = await context.params;
      const videoId = parseInt(params.id, 10);
      if (isNaN(videoId)) {
        return errorResponse('Invalid video ID');
      }

      const json = await req.json();
      const parsed = updateVideoSchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const video = await Video.findByPk(videoId);
      if (!video) {
        return errorResponse('Video not found', 404);
      }

      const data = parsed.data;

      // Track whether this is a first-time publish
      const wasPublished = video.published;

      // Verify category if changed
      if (data.category_id && data.category_id !== video.category_id) {
        const category = await VideoCategory.findByPk(data.category_id);
        if (!category) {
          return errorResponse('Video category not found', 400);
        }
      }

      // If setting is_hero=true, unset on all others first
      if (data.is_hero === true && !video.is_hero) {
        await Video.update({ is_hero: false }, { where: { is_hero: true } });
      }

      // Build update payload with scheduling logic
      const updateData: Record<string, unknown> = { ...data };

      if (data.published_at !== undefined) {
        // Explicit published_at: set it (or clear it with null)
        updateData.published_at = data.published_at ? new Date(data.published_at) : null;
        // Setting a future date auto-marks as published (will be hidden by filter until then)
        if (data.published_at) {
          updateData.published = true;
        }
      } else if (data.published === true && !wasPublished && !video.published_at) {
        // Toggling to published without explicit published_at: set to now
        updateData.published_at = new Date();
      }

      await video.update(updateData);

      // Fire-and-forget: send new_video notifications on first publish
      // Only notify if video is live now (not future-scheduled)
      const isLiveNow = video.published && (!video.published_at || video.published_at <= new Date());
      if (data.published === true && !wasPublished && isLiveNow) {
        dispatchNewVideoNotifications(videoId, video.title, context.user.id).catch(() => {});

        // Trigger broadcast email queue for newly published video
        try {
          const { triggerVideoBroadcast } = await import('@/lib/email/queue');
          await triggerVideoBroadcast(videoId);
        } catch (err) {
          console.error('[Video] Failed to trigger broadcast email:', err);
        }
      }

      // Reload with category
      const updated = await Video.findByPk(videoId, {
        include: [
          {
            model: VideoCategory,
            as: 'category',
            attributes: ['id', 'name', 'slug'],
          },
        ],
      });

      return successResponse({ video: updated });
    } catch (error) {
      return serverError(error, 'Failed to update video');
    }
  }
);

/**
 * DELETE /api/videos/[id] — Admin delete a video (cascades to progress and reactions)
 */
export const DELETE = withAdmin(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const { Video } = await import('@/lib/db/models');

      const params = await context.params;
      const videoId = parseInt(params.id, 10);
      if (isNaN(videoId)) {
        return errorResponse('Invalid video ID');
      }

      const video = await Video.findByPk(videoId);
      if (!video) {
        return errorResponse('Video not found', 404);
      }

      await video.destroy();

      return successResponse({ message: 'Video deleted successfully' });
    } catch (error) {
      return serverError(error, 'Failed to delete video');
    }
  }
);

/**
 * Fire-and-forget: send new_video notifications to all active users.
 * Only sends on first publish (checks for existing new_video notification for this video).
 */
async function dispatchNewVideoNotifications(
  videoId: number,
  videoTitle: string,
  adminId: number
): Promise<void> {
  const { User, Notification } = await import('@/lib/db/models');
  const { createNotification } = await import('@/lib/notifications/create');
  const { NotificationType, NotificationEntityType } = await import('@/lib/notifications/types');

  // Check if notifications were already sent for this video (dedup on first publish)
  const existing = await Notification.findOne({
    where: {
      type: NotificationType.NEW_VIDEO,
      entity_type: NotificationEntityType.VIDEO,
      entity_id: videoId,
    },
    attributes: ['id'],
  });

  if (existing) {
    return; // Already notified
  }

  // Fetch all active users except the admin
  const activeUsers = await User.findAll({
    where: { status: 'active', id: { [Op.ne]: adminId } },
    attributes: ['id'],
    raw: true,
  });

  for (const user of activeUsers) {
    try {
      await createNotification({
        recipient_id: user.id,
        actor_id: adminId,
        type: NotificationType.NEW_VIDEO,
        entity_type: NotificationEntityType.VIDEO,
        entity_id: videoId,
        preview_text: videoTitle,
      });
    } catch {
      // Non-fatal
    }
  }
}
