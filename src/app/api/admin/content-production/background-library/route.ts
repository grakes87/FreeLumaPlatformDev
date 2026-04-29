import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/content-production/background-library
 *
 * Returns paginated background videos from the library.
 * Query params: page (default 1), limit (default 60), search (optional filename filter)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContentBackground } = await import('@/lib/db/models');
    const { Op } = await import('sequelize');

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(120, Math.max(1, parseInt(searchParams.get('limit') || '60', 10)));
    const search = searchParams.get('search')?.trim();
    const offset = (page - 1) * limit;

    const mode = searchParams.get('mode');
    const where: Record<string, unknown> = {};
    if (mode === 'bible' || mode === 'positivity') {
      where.url = { [Op.like]: `%/${mode}/%` };
    }
    if (search) {
      where.url = where.url
        ? { [Op.and]: [where.url, { [Op.like]: `%${search}%` }] }
        : { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await DailyContentBackground.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return successResponse({
      items: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch background library');
  }
});
