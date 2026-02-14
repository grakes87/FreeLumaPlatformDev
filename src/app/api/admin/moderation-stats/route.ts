import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';

/**
 * GET /api/admin/moderation-stats - Dashboard statistics for moderation
 *
 * Returns:
 *   total_reports, pending_reports, reports_today, active_bans,
 *   action_breakdown, repeat_offenders (top 10), moderation_activity_7d
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { Report, Ban, ModerationLog, User, sequelize } = await import('@/lib/db/models');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Core counts (parallel)
    const [totalReports, pendingReports, reportsToday, activeBans] = await Promise.all([
      Report.count(),
      Report.count({ where: { status: 'pending' } }),
      Report.count({ where: { created_at: { [Op.gte]: todayStart } } }),
      Ban.count({
        where: {
          lifted_at: null,
          [Op.or]: [
            { expires_at: null },
            { expires_at: { [Op.gt]: now } },
          ],
        },
      }),
    ]);

    // Action breakdown (GROUP BY action)
    const actionBreakdownRaw = await sequelize.query(
      `SELECT action, COUNT(*) as count FROM moderation_logs GROUP BY action ORDER BY count DESC`,
      { type: 'SELECT' }
    ) as Array<{ action: string; count: number }>;

    const actionBreakdown = actionBreakdownRaw.map((row) => ({
      action: row.action,
      count: Number(row.count),
    }));

    // Repeat offenders: users with most reports against them (top 10)
    // For posts: join reports -> posts -> users
    // For comments: join reports -> post_comments -> users
    const repeatOffendersRaw = await sequelize.query(
      `SELECT
        u.id as user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.avatar_color,
        COUNT(*) as report_count
      FROM reports r
      LEFT JOIN posts p ON r.content_type = 'post' AND r.post_id = p.id
      LEFT JOIN post_comments pc ON r.content_type = 'comment' AND r.comment_id = pc.id
      INNER JOIN users u ON u.id = COALESCE(
        CASE WHEN r.content_type = 'post' THEN p.user_id END,
        CASE WHEN r.content_type = 'comment' THEN pc.user_id END
      )
      GROUP BY u.id, u.username, u.display_name, u.avatar_url, u.avatar_color
      ORDER BY report_count DESC
      LIMIT 10`,
      { type: 'SELECT' }
    ) as Array<{
      user_id: number;
      username: string;
      display_name: string;
      avatar_url: string | null;
      avatar_color: string;
      report_count: number;
    }>;

    const repeatOffenders = repeatOffendersRaw.map((row) => ({
      user_id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      avatar_color: row.avatar_color,
      report_count: Number(row.report_count),
    }));

    // Moderation activity last 7 days (daily counts for chart)
    const activityRaw = await sequelize.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM moderation_logs
      WHERE created_at >= :sevenDaysAgo
      GROUP BY DATE(created_at)
      ORDER BY date ASC`,
      {
        replacements: { sevenDaysAgo },
        type: 'SELECT',
      }
    ) as Array<{ date: string; count: number }>;

    // Fill in missing days with 0
    const activityMap = new Map(activityRaw.map((row) => [row.date, Number(row.count)]));
    const moderationActivity7d: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      moderationActivity7d.push({
        date: dateStr,
        count: activityMap.get(dateStr) || 0,
      });
    }

    return successResponse({
      total_reports: totalReports,
      pending_reports: pendingReports,
      reports_today: reportsToday,
      active_bans: activeBans,
      action_breakdown: actionBreakdown,
      repeat_offenders: repeatOffenders,
      moderation_activity_7d: moderationActivity7d,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch moderation stats');
  }
});
