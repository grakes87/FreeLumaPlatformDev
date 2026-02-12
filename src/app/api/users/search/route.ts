import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op, literal } from 'sequelize';

/**
 * GET /api/users/search?q=<query> - Search users by username or display name
 *
 * - Min 2 characters required
 * - Excludes: self, blocked users
 * - Respects mode isolation
 * - Returns follow_status for each result
 * - Limit 20 results
 */
export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      return errorResponse('Search query must be at least 2 characters', 400);
    }

    const userId = context.user.id;
    const { User, Follow, Block, PlatformSetting } = await import('@/lib/db/models');

    // Get blocked user IDs (both directions)
    const blocks = await Block.findAll({
      where: {
        [Op.or]: [
          { blocker_id: userId },
          { blocked_id: userId },
        ],
      },
      attributes: ['blocker_id', 'blocked_id'],
      raw: true,
    });

    const blockedIds = new Set<number>();
    for (const b of blocks) {
      if (b.blocker_id !== userId) blockedIds.add(b.blocker_id);
      if (b.blocked_id !== userId) blockedIds.add(b.blocked_id);
    }

    // Build exclusion list (self + blocked)
    const excludeIds = [userId, ...Array.from(blockedIds)];

    // Build where clause
    const searchPattern = `%${q}%`;
    const where: Record<string, unknown> = {
      id: { [Op.notIn]: excludeIds },
      deleted_at: null,
      onboarding_complete: true,
      [Op.or]: [
        { username: { [Op.like]: searchPattern } },
        { display_name: { [Op.like]: searchPattern } },
      ],
    };

    // Mode isolation
    const modeIsolation = await PlatformSetting.get('mode_isolation_social');
    if (modeIsolation === 'true') {
      const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
      if (currentUser) {
        where.mode = currentUser.mode;
      }
    }

    const users = await User.findAll({
      where,
      attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color', 'bio'],
      limit: 20,
      order: [
        // Exact username match first, then prefix match, then contains
        [literal(`CASE WHEN username = ${User.sequelize!.escape(q)} THEN 0 WHEN username LIKE ${User.sequelize!.escape(q + '%')} THEN 1 ELSE 2 END`), 'ASC'],
        ['display_name', 'ASC'],
      ],
    });

    // Get follow statuses for all returned users
    const userIds = users.map((u) => u.id);
    const follows = userIds.length > 0
      ? await Follow.findAll({
          where: {
            follower_id: userId,
            following_id: { [Op.in]: userIds },
          },
          attributes: ['following_id', 'status'],
          raw: true,
        })
      : [];

    const followMap = new Map<number, string>();
    for (const f of follows) {
      followMap.set(f.following_id, f.status);
    }

    const results = users.map((u) => ({
      id: u.id,
      display_name: u.display_name,
      username: u.username,
      avatar_url: u.avatar_url,
      avatar_color: u.avatar_color,
      bio: u.bio,
      follow_status: followMap.get(u.id) || 'none',
    }));

    return successResponse({ users: results });
  } catch (error) {
    return serverError(error, 'Failed to search users');
  }
});
