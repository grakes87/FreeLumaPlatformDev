import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/church-outreach/churches/[id]/activities - List activities for a church
 *
 * Query params:
 *   cursor: pagination cursor (activity ID)
 *   limit: items per page (default 20, max 100)
 */
export const GET = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { ChurchActivity } = await import('@/lib/db/models');
    const params = await context.params;
    const churchId = parseInt(params.id, 10);

    if (isNaN(churchId)) {
      return errorResponse('Invalid church ID', 400);
    }

    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { church_id: churchId };

    if (cursor) {
      where.id = { [Op.lt]: parseInt(cursor, 10) };
    }

    const activities = await ChurchActivity.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = activities.length > limit;
    const paginated = activities.slice(0, limit);

    const nextCursor = hasMore && paginated.length > 0
      ? String(paginated[paginated.length - 1].id)
      : null;

    return successResponse({
      activities: paginated.map((a) => a.toJSON()),
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch church activities');
  }
});
