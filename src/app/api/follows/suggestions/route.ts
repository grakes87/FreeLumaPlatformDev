import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';
import { QueryTypes } from 'sequelize';

/**
 * GET /api/follows/suggestions - Get suggested users to follow
 *
 * Mixed algorithm:
 * 1. Popular users (by follower count)
 * 2. Interest-based (shared category overlap)
 * 3. New users (last 30 days)
 *
 * Excludes: already followed, blocked, self
 * Respects mode isolation when enabled.
 */
export const GET = withAuth(async (_req: NextRequest, context: AuthContext) => {
  try {
    const { sequelize, User, PlatformSetting } = await import('@/lib/db/models');

    const userId = context.user.id;

    // Get current user's mode for isolation check
    const currentUser = await User.findByPk(userId, {
      attributes: ['mode'],
    });

    if (!currentUser) {
      return successResponse({ suggestions: [] });
    }

    const modeIsolation = await PlatformSetting.get('mode_isolation_social');
    const modeFilter = modeIsolation === 'true'
      ? 'AND u.mode = :userMode'
      : '';

    // Combined query: popular + interest-based + new users
    // Using UNION to merge three strategies, then deduplicate with outer query
    const query = `
      SELECT id, display_name, username, avatar_url, avatar_color, bio, mode, score
      FROM (
        -- Popular: users with most active followers
        SELECT u.id, u.display_name, u.username, u.avatar_url, u.avatar_color, u.bio, u.mode,
               COUNT(f.id) AS score
        FROM users u
        LEFT JOIN follows f ON f.following_id = u.id AND f.status = 'active'
        WHERE u.id != :userId
          AND u.deleted_at IS NULL
          AND u.onboarding_complete = 1
          AND u.id NOT IN (
            SELECT following_id FROM follows WHERE follower_id = :userId
          )
          AND u.id NOT IN (
            SELECT blocked_id FROM blocks WHERE blocker_id = :userId
            UNION
            SELECT blocker_id FROM blocks WHERE blocked_id = :userId
          )
          ${modeFilter}
        GROUP BY u.id
        ORDER BY score DESC
        LIMIT 10

        UNION ALL

        -- Interest-based: users sharing the most categories with current user
        SELECT u.id, u.display_name, u.username, u.avatar_url, u.avatar_color, u.bio, u.mode,
               COUNT(uc2.category_id) AS score
        FROM users u
        INNER JOIN user_categories uc2 ON uc2.user_id = u.id
        INNER JOIN user_categories uc1 ON uc1.category_id = uc2.category_id AND uc1.user_id = :userId
        WHERE u.id != :userId
          AND u.deleted_at IS NULL
          AND u.onboarding_complete = 1
          AND u.id NOT IN (
            SELECT following_id FROM follows WHERE follower_id = :userId
          )
          AND u.id NOT IN (
            SELECT blocked_id FROM blocks WHERE blocker_id = :userId
            UNION
            SELECT blocker_id FROM blocks WHERE blocked_id = :userId
          )
          ${modeFilter}
        GROUP BY u.id
        ORDER BY score DESC
        LIMIT 10

        UNION ALL

        -- New users: registered in the last 30 days
        SELECT u.id, u.display_name, u.username, u.avatar_url, u.avatar_color, u.bio, u.mode,
               0 AS score
        FROM users u
        WHERE u.id != :userId
          AND u.deleted_at IS NULL
          AND u.onboarding_complete = 1
          AND u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND u.id NOT IN (
            SELECT following_id FROM follows WHERE follower_id = :userId
          )
          AND u.id NOT IN (
            SELECT blocked_id FROM blocks WHERE blocker_id = :userId
            UNION
            SELECT blocker_id FROM blocks WHERE blocked_id = :userId
          )
          ${modeFilter}
        ORDER BY u.created_at DESC
        LIMIT 10
      ) AS combined
      GROUP BY id
      ORDER BY score DESC
      LIMIT 20
    `;

    const suggestions = await sequelize.query(query, {
      replacements: { userId, userMode: currentUser.mode },
      type: QueryTypes.SELECT,
    });

    return successResponse({ suggestions });
  } catch (error) {
    return serverError(error, 'Failed to fetch suggestions');
  }
});
