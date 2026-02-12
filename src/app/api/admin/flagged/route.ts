import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/flagged - Quick summary counts for dashboard
 *
 * Returns:
 *   flagged_posts: number of flagged posts
 *   flagged_comments: number of flagged comments
 *   pending_reports: number of pending reports
 */
export const GET = withAdmin(async (_req: NextRequest, _context: AuthContext) => {
  try {
    const { Post, PostComment, Report } = await import('@/lib/db/models');

    const [flaggedPosts, flaggedComments, pendingReports] = await Promise.all([
      Post.count({ where: { flagged: true }, paranoid: false }),
      PostComment.count({ where: { flagged: true } }),
      Report.count({ where: { status: 'pending' } }),
    ]);

    return successResponse({
      flagged_posts: flaggedPosts,
      flagged_comments: flaggedComments,
      pending_reports: pendingReports,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch flagged content counts');
  }
});
