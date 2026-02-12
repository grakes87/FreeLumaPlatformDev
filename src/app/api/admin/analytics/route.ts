import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { QueryTypes } from 'sequelize';

/**
 * GET /api/admin/analytics - Analytics data for admin dashboard
 *
 * Query params:
 *   period: '7d' | '30d' | '90d' (default '30d')
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { sequelize, User, Post, PostReaction, PostComment } = await import('@/lib/db/models');
    const { searchParams } = new URL(req.url);

    const period = searchParams.get('period') || '30d';
    const validPeriods = ['7d', '30d', '90d'];
    if (!validPeriods.includes(period)) {
      return errorResponse('Invalid period. Use 7d, 30d, or 90d', 400);
    }

    const days = parseInt(period);

    // User growth: new users per day
    const userGrowth = await sequelize.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
         AND deleted_at IS NULL
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      { replacements: { days }, type: QueryTypes.SELECT }
    );

    // Post volume: posts per day
    const postVolume = await sequelize.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM posts
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
         AND deleted_at IS NULL
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      { replacements: { days }, type: QueryTypes.SELECT }
    );

    // Prayer requests: prayer posts per day
    const prayerVolume = await sequelize.query(
      `SELECT DATE(p.created_at) as date, COUNT(*) as count
       FROM posts p
       WHERE p.post_type = 'prayer_request'
         AND p.created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
         AND p.deleted_at IS NULL
       GROUP BY DATE(p.created_at)
       ORDER BY date ASC`,
      { replacements: { days }, type: QueryTypes.SELECT }
    );

    // Engagement: reactions + comments per day
    const engagement = await sequelize.query(
      `SELECT date, SUM(cnt) as count FROM (
         SELECT DATE(created_at) as date, COUNT(*) as cnt
         FROM post_reactions
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
         GROUP BY DATE(created_at)
         UNION ALL
         SELECT DATE(created_at) as date, COUNT(*) as cnt
         FROM post_comments
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
         GROUP BY DATE(created_at)
       ) AS combined
       GROUP BY date
       ORDER BY date ASC`,
      { replacements: { days }, type: QueryTypes.SELECT }
    );

    // Active users: distinct users posting/reacting/commenting per day
    const activeUsers = await sequelize.query(
      `SELECT date, COUNT(DISTINCT user_id) as count FROM (
         SELECT DATE(created_at) as date, user_id
         FROM posts
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
           AND deleted_at IS NULL
         UNION ALL
         SELECT DATE(created_at) as date, user_id
         FROM post_reactions
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
         UNION ALL
         SELECT DATE(created_at) as date, user_id
         FROM post_comments
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
       ) AS combined
       GROUP BY date
       ORDER BY date ASC`,
      { replacements: { days }, type: QueryTypes.SELECT }
    );

    // Top content: top 5 posts by engagement (reaction + comment count)
    const topContent = await sequelize.query(
      `SELECT p.id, p.body, p.post_type, p.created_at,
              u.display_name as author_name, u.username as author_username,
              u.avatar_url as author_avatar_url, u.avatar_color as author_avatar_color,
              (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) as reaction_count,
              (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as comment_count,
              (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id)
              + (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as total_engagement
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
         AND p.deleted_at IS NULL
       ORDER BY total_engagement DESC
       LIMIT 5`,
      { replacements: { days }, type: QueryTypes.SELECT }
    );

    // Totals
    const [totalUsers] = await sequelize.query(
      `SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL`,
      { type: QueryTypes.SELECT }
    ) as Array<{ count: number }>;

    const [totalPosts] = await sequelize.query(
      `SELECT COUNT(*) as count FROM posts WHERE deleted_at IS NULL`,
      { type: QueryTypes.SELECT }
    ) as Array<{ count: number }>;

    const [totalPrayers] = await sequelize.query(
      `SELECT COUNT(*) as count FROM posts WHERE post_type = 'prayer_request' AND deleted_at IS NULL`,
      { type: QueryTypes.SELECT }
    ) as Array<{ count: number }>;

    const [totalReactions] = await sequelize.query(
      `SELECT COUNT(*) as count FROM post_reactions`,
      { type: QueryTypes.SELECT }
    ) as Array<{ count: number }>;

    return successResponse({
      user_growth: userGrowth,
      post_volume: postVolume,
      prayer_volume: prayerVolume,
      engagement,
      active_users: activeUsers,
      top_content: topContent,
      totals: {
        users: totalUsers?.count || 0,
        posts: totalPosts?.count || 0,
        prayers: totalPrayers?.count || 0,
        reactions: totalReactions?.count || 0,
      },
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch analytics');
  }
});
