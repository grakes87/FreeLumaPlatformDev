import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const lumashortVideoSchema = z.object({
  daily_content_id: z.number().int().positive(),
  video_url: z.string().url(),
});

/**
 * POST /api/admin/content-production/lumashort-video
 *
 * Links an uploaded lumashort video URL to a specific daily content record.
 *
 * Body:
 *   { daily_content_id: number, video_url: string }
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContent } = await import('@/lib/db/models');

    const json = await req.json();
    const parsed = lumashortVideoSchema.safeParse(json);

    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || 'Invalid input',
        400
      );
    }

    const { daily_content_id, video_url } = parsed.data;

    const row = await DailyContent.findByPk(daily_content_id);
    if (!row) {
      return errorResponse('Daily content not found', 404);
    }

    await row.update({ lumashort_video_url: video_url });

    return successResponse({ updated: true });
  } catch (error) {
    return serverError(error, 'Failed to update lumashort video');
  }
});
