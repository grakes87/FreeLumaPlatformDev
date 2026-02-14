import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { withAdmin } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { fn, col } from 'sequelize';

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
});

/**
 * GET /api/videos/[id] — Get video detail with user-specific progress and reactions
 */
export const GET = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
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

      const userId = context.user.id;

      // Check if user is admin
      const adminUser = await User.findByPk(userId, { attributes: ['id', 'is_admin'] });
      const isAdmin = adminUser?.is_admin === true;

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

      // Non-admin users cannot see unpublished videos
      if (!video.published && !isAdmin) {
        return errorResponse('Video not found', 404);
      }

      // Get user's progress
      const userProgress = await VideoProgress.findOne({
        where: { user_id: userId, video_id: videoId },
        attributes: ['watched_seconds', 'last_position', 'duration_seconds', 'completed'],
      });

      // Get user's reaction
      const userReaction = await VideoReaction.findOne({
        where: { user_id: userId, video_id: videoId },
        attributes: ['reaction_type'],
      });

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

      await video.update(data);

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
