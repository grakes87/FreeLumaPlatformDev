import { NextRequest, NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';
import { hashPassword } from '@/lib/auth/password';
import { AVATAR_COLORS } from '@/lib/utils/constants';

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

/**
 * POST /api/admin/users - Admin creates a new user account
 *
 * Body: { email, username, display_name, password, mode? }
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { User } = await import('@/lib/db/models');
    const body = await req.json();

    const { email, username, display_name, password, mode } = body as {
      email?: string;
      username?: string;
      display_name?: string;
      password?: string;
      mode?: string;
    };

    if (!email?.trim() || !username?.trim() || !display_name?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: 'email, username, display_name, and password are required' },
        { status: 400 }
      );
    }

    // Check duplicates
    const existing = await User.findOne({
      where: {
        [Op.or]: [
          { email: email.trim().toLowerCase() },
          { username: username.trim().toLowerCase() },
        ],
      },
      paranoid: false,
    });

    if (existing) {
      const field = existing.email === email.trim().toLowerCase() ? 'email' : 'username';
      return NextResponse.json(
        { error: `A user with that ${field} already exists` },
        { status: 409 }
      );
    }

    const password_hash = await hashPassword(password.trim());
    const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const user = await User.create({
      email: email.trim().toLowerCase(),
      username: username.trim().toLowerCase(),
      display_name: display_name.trim(),
      password_hash,
      avatar_color,
      mode: mode === 'positivity' ? 'positivity' : 'bible',
      is_verified: true,
      email_verified: true,
      status: 'active',
      role: 'user',
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        avatar_color: user.avatar_color,
      },
    }, { status: 201 });
  } catch (error) {
    return serverError(error, 'Failed to create user');
  }
});
