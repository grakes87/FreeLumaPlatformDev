import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op, literal } from 'sequelize';

/**
 * GET /api/users/search?q=<query> - Search users by username or display name
 *
 * Optional params:
 *   followers_only=true - restrict to mutual followers (accepted follows)
 *   limit=N            - max results (default 20, max 50)
 *
 * When followers_only=true, empty q is allowed (returns all followers).
 * Otherwise min 2 characters required for q.
 *
 * Excludes: self, blocked users
 * Respects mode isolation
 * Returns follow_status for each result
 */
export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const followersOnly = searchParams.get('followers_only') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    if (!followersOnly && q.length < 2) {
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

    // If followers_only, restrict to users who have an accepted follow relationship
    let followerIds: number[] | null = null;
    if (followersOnly) {
      // Mutual: people who follow the user OR the user follows (accepted)
      const followRows = await Follow.findAll({
        where: {
          [Op.or]: [
            { follower_id: userId, status: 'active' },
            { following_id: userId, status: 'active' },
          ],
        },
        attributes: ['follower_id', 'following_id'],
        raw: true,
      });

      const ids = new Set<number>();
      for (const f of followRows) {
        if (f.follower_id !== userId) ids.add(f.follower_id);
        if (f.following_id !== userId) ids.add(f.following_id);
      }
      // Remove blocked/self
      for (const id of excludeIds) ids.delete(id);
      followerIds = Array.from(ids);

      if (followerIds.length === 0) {
        return successResponse({ users: [] });
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {
      id: followerIds
        ? { [Op.in]: followerIds }
        : { [Op.notIn]: excludeIds },
      deleted_at: null,
      onboarding_complete: true,
    };

    // Add search filter if query provided
    if (q.length >= 2) {
      const searchPattern = `%${q}%`;
      where[Op.or as unknown as string] = [
        { username: { [Op.like]: searchPattern } },
        { display_name: { [Op.like]: searchPattern } },
      ];
    }

    // Mode isolation
    const modeIsolation = await PlatformSetting.get('mode_isolation_social');
    if (modeIsolation === 'true') {
      const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
      if (currentUser) {
        where.mode = currentUser.mode;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderClauses: any[] = [];
    if (q.length >= 2) {
      orderClauses.push(
        [literal(`CASE WHEN username = ${User.sequelize!.escape(q)} THEN 0 WHEN username LIKE ${User.sequelize!.escape(q + '%')} THEN 1 ELSE 2 END`), 'ASC']
      );
    }
    orderClauses.push(['display_name', 'ASC']);

    const users = await User.findAll({
      where,
      attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color', 'bio', 'is_verified'],
      limit: limit + 1, // Fetch one extra to detect if there are more
      offset,
      order: orderClauses,
    });

    const hasMore = users.length > limit;
    if (hasMore) users.pop(); // Remove the extra row

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

    return successResponse({ users: results, hasMore, nextOffset: hasMore ? offset + limit : null });
  } catch (error) {
    return serverError(error, 'Failed to search users');
  }
});
