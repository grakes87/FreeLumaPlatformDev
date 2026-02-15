import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/users - List users with search, filtering, and pagination
 *
 * Query params:
 *   search: search by username, display_name, or email (LIKE)
 *   q: alias for search (backwards compatible)
 *   role: filter by role (user, moderator, admin)
 *   status: filter by status (active, deactivated, pending_deletion, banned)
 *   mode: filter by mode (bible, positivity)
 *   cursor: pagination cursor (user ID)
 *   limit: items per page (default 20, max 100)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { User, Ban } = await import('@/lib/db/models');
    const url = new URL(req.url);

    const search = url.searchParams.get('search') || url.searchParams.get('q');
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');
    const mode = url.searchParams.get('mode');
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      const searchTerm = `%${search.trim()}%`;
      where[Op.or] = [
        { display_name: { [Op.like]: searchTerm } },
        { username: { [Op.like]: searchTerm } },
        { email: { [Op.like]: searchTerm } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    if (mode) {
      where.mode = mode;
    }

    if (cursor) {
      where.id = { ...(where.id || {}), [Op.lt]: parseInt(cursor, 10) };
    }

    const users = await User.findAll({
      where,
      attributes: [
        'id', 'email', 'username', 'display_name', 'avatar_url', 'avatar_color',
        'role', 'status', 'is_admin', 'is_verified', 'mode',
        'created_at', 'last_login_at',
      ],
      order: [['id', 'DESC']],
      limit: limit + 1,
      paranoid: false,
    });

    const hasMore = users.length > limit;
    const paginatedUsers = users.slice(0, limit);

    // For banned users, fetch active ban info
    const bannedUserIds = paginatedUsers
      .filter((u) => u.status === 'banned')
      .map((u) => u.id);

    let activeBansMap: Record<number, Record<string, unknown>> = {};
    if (bannedUserIds.length > 0) {
      const activeBans = await Ban.findAll({
        where: {
          user_id: { [Op.in]: bannedUserIds },
          lifted_at: null,
          [Op.or]: [
            { expires_at: null },
            { expires_at: { [Op.gt]: new Date() } },
          ],
        },
        attributes: ['id', 'user_id', 'reason', 'duration', 'expires_at', 'created_at'],
        order: [['created_at', 'DESC']],
      });

      activeBansMap = {};
      for (const ban of activeBans) {
        const banJson = ban.toJSON() as unknown as Record<string, unknown>;
        const uid = banJson.user_id as number;
        // Take the most recent active ban per user
        if (!activeBansMap[uid]) {
          activeBansMap[uid] = banJson;
        }
      }
    }

    const nextCursor = hasMore && paginatedUsers.length > 0
      ? String(paginatedUsers[paginatedUsers.length - 1].id)
      : null;

    const userList = paginatedUsers.map((u) => {
      const json = u.toJSON() as unknown as Record<string, unknown>;
      return {
        ...json,
        active_ban: activeBansMap[u.id] || null,
      };
    });

    return successResponse({
      users: userList,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch users');
  }
});
