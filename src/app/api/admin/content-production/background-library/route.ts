import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/content-production/background-library
 *
 * Returns all background videos from the library.
 */
export const GET = withAdmin(async (_req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContentBackground } = await import('@/lib/db/models');

    const backgrounds = await DailyContentBackground.findAll({
      order: [['created_at', 'DESC']],
    });

    return successResponse(backgrounds);
  } catch (error) {
    return serverError(error, 'Failed to fetch background library');
  }
});
