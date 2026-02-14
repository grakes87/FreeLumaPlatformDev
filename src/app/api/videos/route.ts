import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { withAdmin } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';

const VIDEOS_PER_CATEGORY = 10;

const createVideoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  category_id: z.number().int().positive('Valid category required'),
  video_url: z.string().url('Valid video URL required'),
  duration_seconds: z.number().int().min(0).default(0),
  thumbnail_url: z.string().url().optional(),
  caption_url: z.string().url().optional(),
  is_hero: z.boolean().optional(),
  published: z.boolean().optional(),
});

/**
 * GET /api/videos — List videos grouped by category (Netflix-style) or by single category
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const {
        Video,
        VideoCategory,
        VideoProgress,
        User,
      } = await import('@/lib/db/models');

      const { searchParams } = new URL(req.url);
      const categoryId = searchParams.get('category_id');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
      const cursor = searchParams.get('cursor');
      const userId = context.user.id;

      // Check if user is admin (for showing unpublished)
      const adminUser = await User.findByPk(userId, { attributes: ['id', 'is_admin'] });
      const isAdmin = adminUser?.is_admin === true;

      const publishedFilter = isAdmin ? {} : { published: true };

      // If category_id provided: paginated list of videos in that category
      if (categoryId) {
        const catId = parseInt(categoryId, 10);
        if (isNaN(catId)) {
          return errorResponse('Invalid category_id');
        }

        const where: Record<string, unknown> = {
          category_id: catId,
          ...publishedFilter,
        };

        if (cursor) {
          where.id = { [Op.lt]: parseInt(cursor, 10) };
        }

        const videos = await Video.findAll({
          where,
          attributes: [
            'id', 'title', 'description', 'thumbnail_url',
            'duration_seconds', 'view_count', 'published', 'created_at',
          ],
          order: [['view_count', 'DESC'], ['id', 'DESC']],
          limit: limit + 1,
        });

        const hasMore = videos.length > limit;
        const results = hasMore ? videos.slice(0, limit) : videos;
        const nextCursor = hasMore ? results[results.length - 1]?.id : null;

        return successResponse({
          videos: results,
          next_cursor: nextCursor,
          has_more: hasMore,
        });
      }

      // No category_id: grouped by category for Netflix-style layout
      const categories = await VideoCategory.findAll({
        where: { is_active: true },
        attributes: ['id', 'name', 'slug'],
        order: [['sort_order', 'ASC'], ['name', 'ASC']],
      });

      const groupedCategories = await Promise.all(
        categories.map(async (cat) => {
          const videos = await Video.findAll({
            where: {
              category_id: cat.id,
              ...publishedFilter,
            },
            attributes: [
              'id', 'title', 'description', 'thumbnail_url',
              'duration_seconds', 'view_count', 'published', 'created_at',
            ],
            order: [['view_count', 'DESC']],
            limit: VIDEOS_PER_CATEGORY,
          });

          return {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            videos,
          };
        })
      );

      // Filter out categories with no videos
      const nonEmptyCategories = groupedCategories.filter((c) => c.videos.length > 0);

      // Continue Watching row: user's in-progress videos
      const progressRows = await VideoProgress.findAll({
        where: {
          user_id: userId,
          completed: false,
        },
        include: [
          {
            model: Video,
            as: 'video',
            attributes: [
              'id', 'title', 'description', 'thumbnail_url',
              'duration_seconds', 'view_count', 'published', 'created_at',
            ],
            where: publishedFilter,
          },
        ],
        order: [['updated_at', 'DESC']],
        limit: VIDEOS_PER_CATEGORY,
      });

      const continueWatching = progressRows.map((p) => {
        const json = p.toJSON() as Record<string, unknown>;
        const videoData = json.video as Record<string, unknown>;
        return {
          ...videoData,
          progress: {
            watched_seconds: p.watched_seconds,
            last_position: p.last_position,
            duration_seconds: p.duration_seconds,
          },
        };
      });

      return successResponse({
        categories: nonEmptyCategories,
        continue_watching: continueWatching,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch videos');
    }
  }
);

/**
 * POST /api/videos — Admin create a new video
 */
export const POST = withAdmin(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { Video, VideoCategory } = await import('@/lib/db/models');

      const json = await req.json();
      const parsed = createVideoSchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const data = parsed.data;

      // Verify category exists
      const category = await VideoCategory.findByPk(data.category_id);
      if (!category) {
        return errorResponse('Video category not found', 400);
      }

      // If is_hero=true, unset on all others
      if (data.is_hero) {
        await Video.update({ is_hero: false }, { where: { is_hero: true } });
      }

      const video = await Video.create({
        title: data.title,
        description: data.description ?? null,
        category_id: data.category_id,
        video_url: data.video_url,
        duration_seconds: data.duration_seconds,
        thumbnail_url: data.thumbnail_url ?? null,
        caption_url: data.caption_url ?? null,
        is_hero: data.is_hero ?? false,
        published: data.published ?? false,
        uploaded_by: context.user.id,
      });

      // Reload with category
      const created = await Video.findByPk(video.id, {
        include: [
          {
            model: VideoCategory,
            as: 'category',
            attributes: ['id', 'name', 'slug'],
          },
        ],
      });

      // Fire-and-forget: send new_video notifications if published on creation
      if (video.published) {
        dispatchNewVideoNotifications(video.id, video.title, context.user.id).catch(() => {});
      }

      return successResponse({ video: created }, 201);
    } catch (error) {
      return serverError(error, 'Failed to create video');
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
    return; // Already notified — skip
  }

  // Fetch all active users except the admin
  const activeUsers = await User.findAll({
    where: { status: 'active', id: { [Op.ne]: adminId } },
    attributes: ['id'],
    raw: true,
  });

  // Send notifications in batches to avoid blocking
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
      // Non-fatal: continue sending to other users
    }
  }
}
