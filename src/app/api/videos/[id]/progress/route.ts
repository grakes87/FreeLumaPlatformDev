import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { Video, VideoProgress } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { trackActivity } from '@/lib/streaks/tracker';

const progressSchema = z.object({
  watched_seconds: z.number().int().min(0),
  duration_seconds: z.number().int().min(0),
  last_position: z.number().int().min(0),
  completed: z.boolean().optional(),
});

/**
 * PUT /api/videos/[id]/progress
 * Save or update video watch progress (idempotent upsert).
 * watched_seconds takes max of current and incoming (cumulative).
 * last_position always updates (resume point).
 * completed is one-way: once true, stays true.
 */
export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const videoId = parseInt(params.id, 10);
      if (isNaN(videoId)) {
        return errorResponse('Invalid video ID');
      }

      const body = await req.json();
      const parsed = progressSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { watched_seconds, duration_seconds, last_position, completed } = parsed.data;
      const user_id = context.user.id;

      // Verify video exists
      const video = await Video.findByPk(videoId, { attributes: ['id'] });
      if (!video) {
        return errorResponse('Video not found', 404);
      }

      // Find existing progress record
      const existing = await VideoProgress.findOne({
        where: { user_id, video_id: videoId },
      });

      if (existing) {
        const updates: {
          watched_seconds?: number;
          duration_seconds?: number;
          last_position?: number;
          completed?: boolean;
        } = {};

        // Take the max of current and incoming -- idempotent cumulative total
        if (watched_seconds > existing.watched_seconds) {
          updates.watched_seconds = watched_seconds;
        }

        // Always update last_position (resume point)
        updates.last_position = last_position;

        // Always update duration_seconds to latest value
        updates.duration_seconds = duration_seconds;

        // Once completed, stays completed
        if (completed && !existing.completed) {
          updates.completed = true;
        }

        await existing.update(updates);

        // Track video_watch activity for streaks (fire-and-forget)
        if (existing.completed || (duration_seconds > 0 && watched_seconds > duration_seconds * 0.75)) {
          try { trackActivity(user_id, 'video_watch'); } catch {}
        }

        return successResponse({
          watched_seconds: existing.watched_seconds,
          last_position: existing.last_position,
          completed: existing.completed,
          duration_seconds: existing.duration_seconds,
        });
      }

      // Create new progress record
      const progress = await VideoProgress.create({
        user_id,
        video_id: videoId,
        watched_seconds,
        duration_seconds,
        last_position,
        completed: completed ?? false,
      });

      // Track video_watch activity for streaks (fire-and-forget)
      if (completed || (duration_seconds > 0 && watched_seconds > duration_seconds * 0.75)) {
        try { trackActivity(user_id, 'video_watch'); } catch {}
      }

      return successResponse({
        watched_seconds: progress.watched_seconds,
        last_position: progress.last_position,
        completed: progress.completed,
        duration_seconds: progress.duration_seconds,
      });
    } catch (error) {
      return serverError(error, 'Failed to save video progress');
    }
  }
);
