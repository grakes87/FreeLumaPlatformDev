import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const backgroundVideoSchema = z.object({
  uploads: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
      video_url: z.string().url().max(500),
    })
  ).min(1, 'At least one upload is required'),
});

/**
 * POST /api/admin/content-production/background-video
 *
 * Links uploaded background video URLs to daily content records by date.
 * The admin uploads videos to B2/CDN separately, then calls this endpoint
 * to associate video URLs with specific calendar dates.
 *
 * Body:
 *   uploads: Array<{ date: string (YYYY-MM-DD), video_url: string }>
 *
 * Returns:
 *   { updated: number, not_found: string[] }
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContent } = await import('@/lib/db/models');

    const json = await req.json();
    const parsed = backgroundVideoSchema.safeParse(json);

    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || 'Invalid input',
        400
      );
    }

    const { uploads } = parsed.data;
    let updated = 0;
    const notFound: string[] = [];

    for (const upload of uploads) {
      // Find DailyContent rows for this date (may have both bible + positivity)
      const rows = await DailyContent.findAll({
        where: { post_date: upload.date },
      });

      if (rows.length === 0) {
        notFound.push(upload.date);
        continue;
      }

      // Update video_background_url on all matching rows for this date
      for (const row of rows) {
        await row.update({ video_background_url: upload.video_url });
        updated++;
      }
    }

    return successResponse({ updated, not_found: notFound });
  } catch (error) {
    return serverError(error, 'Failed to update background videos');
  }
});
