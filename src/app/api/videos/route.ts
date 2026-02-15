import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op, literal } from 'sequelize';

const VIDEOS_PER_CATEGORY = 10;

const createVideoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  category_id: z.number().int().positive('Valid category required').nullable().optional(),
  video_url: z.string().url('Valid video URL required'),
  duration_seconds: z.number().int().min(0).default(0),
  thumbnail_url: z.string().url().optional(),
  caption_url: z.string().url().optional(),
  is_hero: z.boolean().optional(),
  published: z.boolean().optional(),
  published_at: z.string().datetime().nullable().optional(),
});

/**
 * Build the WHERE clause that hides drafts and future-scheduled videos from public.
 * Admin with ?drafts=true sees everything.
 */
function publicVideoFilter(): Record<string, unknown> {
  return {
    published: true,
    [Op.or]: [
      { published_at: null },
      { published_at: { [Op.lte]: literal('NOW()') } },
    ],
  };
}

/**
 * GET /api/videos — List videos grouped by category (Netflix-style) or by single category
 */
export const GET = withOptionalAuth(
  async (req: NextRequest, context: OptionalAuthContext) => {
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
      const drafts = searchParams.get('drafts') === 'true';
      const userId = context.user?.id ?? null;

      // Only admins can use ?drafts=true to see all videos
      let isAdmin = false;
      if (userId) {
        const adminUser = await User.findByPk(userId, { attributes: ['id', 'is_admin'] });
        isAdmin = adminUser?.is_admin === true;
      }

      const publishedFilter = (isAdmin && drafts) ? {} : publicVideoFilter();

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
            'duration_seconds', 'view_count', 'is_hero', 'published', 'published_at', 'created_at',
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
              'duration_seconds', 'view_count', 'is_hero', 'published', 'published_at', 'created_at',
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

      // Uncategorized videos (category_id IS NULL)
      const uncategorizedVideos = await Video.findAll({
        where: {
          category_id: null,
          ...publishedFilter,
        },
        attributes: [
          'id', 'title', 'description', 'thumbnail_url',
          'duration_seconds', 'view_count', 'is_hero', 'published', 'published_at', 'created_at',
        ],
        order: [['view_count', 'DESC']],
        limit: VIDEOS_PER_CATEGORY,
      });

      // Top 10 most watched
      const top10 = await Video.findAll({
        where: publishedFilter,
        attributes: [
          'id', 'title', 'description', 'thumbnail_url',
          'duration_seconds', 'view_count', 'is_hero', 'published', 'published_at', 'created_at',
        ],
        order: [['view_count', 'DESC']],
        limit: 10,
      });

      // Continue Watching row: user's in-progress videos (only for logged-in users)
      let continueWatching: Record<string, unknown>[] = [];
      if (userId) {
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
                'duration_seconds', 'view_count', 'is_hero', 'published', 'published_at', 'created_at',
              ],
              where: publishedFilter,
            },
          ],
          order: [['updated_at', 'DESC']],
          limit: VIDEOS_PER_CATEGORY,
        });

        continueWatching = progressRows.map((p) => {
          const json = p.toJSON() as unknown as Record<string, unknown>;
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
      }

      return successResponse({
        categories: nonEmptyCategories,
        continue_watching: continueWatching,
        top_10: top10,
        uncategorized: uncategorizedVideos,
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

      // Verify category exists (if provided)
      if (data.category_id) {
        const category = await VideoCategory.findByPk(data.category_id);
        if (!category) {
          return errorResponse('Video category not found', 400);
        }
      }

      // If is_hero=true, unset on all others
      if (data.is_hero) {
        await Video.update({ is_hero: false }, { where: { is_hero: true } });
      }

      // Determine published_at:
      // - If explicit published_at provided, use it (scheduled or immediate)
      // - If published=true but no published_at, set to now
      // - If not published, leave null
      const isPublished = data.published ?? false;
      let publishedAt: Date | null = null;
      if (data.published_at) {
        publishedAt = new Date(data.published_at);
      } else if (isPublished) {
        publishedAt = new Date();
      }

      const video = await Video.create({
        title: data.title,
        description: data.description ?? null,
        category_id: data.category_id ?? null,
        video_url: data.video_url,
        duration_seconds: data.duration_seconds,
        thumbnail_url: data.thumbnail_url ?? null,
        caption_url: data.caption_url ?? null,
        is_hero: data.is_hero ?? false,
        published: isPublished || publishedAt !== null,
        published_at: publishedAt,
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

      // Fire-and-forget: send new_video notifications only if published NOW (not future-scheduled)
      const isLiveNow = video.published && (!video.published_at || video.published_at <= new Date());
      if (isLiveNow) {
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
