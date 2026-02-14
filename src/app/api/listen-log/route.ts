import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { ListenLog } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const listenLogSchema = z.object({
  daily_content_id: z.number().int().positive(),
  listen_seconds: z.number().int().positive().max(7200),
  completed: z.boolean().optional(),
});

export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const body = await req.json();
      const parsed = listenLogSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { daily_content_id, listen_seconds, completed } = parsed.data;
      const user_id = context.user.id;

      const existing = await ListenLog.findOne({
        where: { user_id, daily_content_id },
      });

      if (existing) {
        const updates: { listen_seconds?: number; completed?: boolean } = {};

        // Take the max of current and incoming — idempotent cumulative total
        if (listen_seconds > existing.listen_seconds) {
          updates.listen_seconds = listen_seconds;
        }

        // Once completed, stays completed
        if (completed && !existing.completed) {
          updates.completed = true;
        }

        if (Object.keys(updates).length > 0) {
          await existing.update(updates);
        }

        // Fire-and-forget: track audio listen when completed
        if (completed && !existing.completed) {
          import('@/lib/streaks/tracker').then(({ trackActivity }) => {
            trackActivity(user_id, 'audio_listen').catch(() => {});
          }).catch(() => {});
        }

        return successResponse({
          listen_seconds: existing.listen_seconds,
          completed: existing.completed,
        });
      }

      const log = await ListenLog.create({
        user_id,
        daily_content_id,
        listen_seconds,
        completed: completed ?? false,
      });

      // Fire-and-forget: track audio listen when completed
      if (completed) {
        import('@/lib/streaks/tracker').then(({ trackActivity }) => {
          trackActivity(user_id, 'audio_listen').catch(() => {});
        }).catch(() => {});
      }

      return successResponse({
        listen_seconds: log.listen_seconds,
        completed: log.completed,
      });
    } catch (error) {
      return serverError(error, 'Failed to log listen time');
    }
  }
);
