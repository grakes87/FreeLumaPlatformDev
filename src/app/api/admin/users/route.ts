import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/users — List users (with optional search)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { User } = await import('@/lib/db/models');
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (q) {
      where[Op.or] = [
        { display_name: { [Op.like]: `%${q}%` } },
        { username: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
      ];
    }

    const users = await User.findAll({
      where,
      attributes: [
        'id', 'username', 'display_name', 'email',
        'avatar_url', 'avatar_color', 'is_verified', 'is_admin', 'created_at',
      ],
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    return successResponse({ users });
  } catch (error) {
    return serverError(error, 'Failed to fetch users');
  }
});
