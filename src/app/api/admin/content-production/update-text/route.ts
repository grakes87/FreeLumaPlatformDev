import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const bodySchema = z.object({
  daily_content_id: z.number().int().positive(),
  content_text: z.string(),
});

/**
 * PATCH /api/admin/content-production/update-text
 *
 * Updates the content_text field of a daily_content row.
 */
export const PATCH = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContent } = await import('@/lib/db/models');

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid request body', 400);
    }

    const { daily_content_id, content_text } = parsed.data;

    const row = await DailyContent.findByPk(daily_content_id);
    if (!row) {
      return errorResponse('Daily content not found', 404);
    }

    await row.update({ content_text });

    return successResponse({ updated: true });
  } catch (error) {
    return serverError(error, 'Failed to update content text');
  }
});
