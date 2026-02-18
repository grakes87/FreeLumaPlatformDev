import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/content-production/logs?daily_content_id=123
 *
 * Returns generation logs for a specific daily content item.
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { ContentGenerationLog } = await import('@/lib/db/models');

    const { searchParams } = new URL(req.url);
    const dailyContentId = searchParams.get('daily_content_id');

    if (!dailyContentId) {
      return errorResponse('daily_content_id is required', 400);
    }

    const logs = await ContentGenerationLog.findAll({
      where: { daily_content_id: parseInt(dailyContentId, 10) },
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    return successResponse(logs.map((log) => ({
      id: log.id,
      field: log.field,
      translation_code: log.translation_code,
      status: log.status,
      error_message: log.error_message,
      duration_ms: log.duration_ms,
      created_at: log.created_at,
    })));
  } catch (error) {
    return serverError(error, 'Failed to fetch generation logs');
  }
});
