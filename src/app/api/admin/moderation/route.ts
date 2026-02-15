import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';

/**
 * GET /api/admin/moderation - Enhanced moderation queue
 *
 * Groups reports by (content_type, content_id) — one queue entry per reported item.
 * Each group includes all reporters with reasons, count, content preview, author info.
 *
 * Query params:
 *   status: 'pending' | 'reviewed' | 'dismissed' (default 'pending')
 *   content_type: 'post' | 'comment' (optional filter)
 *   cursor: pagination cursor (report count + first report id encoded)
 *   limit: items per page (default 20, max 50)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { Report, Post, PostComment, User, sequelize } = await import('@/lib/db/models');
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') || 'pending';
    const contentType = searchParams.get('content_type');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    // Build WHERE clause for reports
    const reportWhere: Record<string, unknown> = {};
    if (status !== 'all') {
      reportWhere.status = status;
    }
    if (contentType) {
      reportWhere.content_type = contentType;
    }

    // Step 1: Get grouped report entries (content_type + content_id pairs)
    // Using raw SQL for the grouping query for efficiency
    const statusClause = status !== 'all' ? `AND r.status = :status` : '';
    const typeClause = contentType ? `AND r.content_type = :contentType` : '';

    // Cursor is encoded as "count:firstId" for stable pagination
    let cursorClause = '';
    const replacements: Record<string, unknown> = {};
    if (status !== 'all') replacements.status = status;
    if (contentType) replacements.contentType = contentType;

    if (cursor) {
      const [cursorCount, cursorId] = cursor.split(':');
      cursorClause = `HAVING report_count < :cursorCount OR (report_count = :cursorCount AND MIN(r.id) > :cursorId)`;
      replacements.cursorCount = parseInt(cursorCount, 10);
      replacements.cursorId = parseInt(cursorId, 10);
    }

    const groupQuery = `
      SELECT
        r.content_type,
        COALESCE(r.post_id, 0) as content_id_post,
        COALESCE(r.comment_id, 0) as content_id_comment,
        COUNT(*) as report_count,
        MIN(r.created_at) as first_reported_at,
        MIN(r.id) as first_report_id,
        r.status
      FROM reports r
      WHERE 1=1 ${statusClause} ${typeClause}
      GROUP BY r.content_type, r.post_id, r.comment_id, r.status
      ${cursorClause}
      ORDER BY report_count DESC, first_report_id ASC
      LIMIT :queryLimit
    `;
    replacements.queryLimit = limit + 1;

    const groups = await sequelize.query(groupQuery, {
      replacements,
      type: 'SELECT',
    }) as Array<{
      content_type: string;
      content_id_post: number;
      content_id_comment: number;
      report_count: number;
      first_reported_at: string;
      first_report_id: number;
      status: string;
    }>;

    const hasMore = groups.length > limit;
    const paginatedGroups = groups.slice(0, limit);

    // Step 2: For each group, fetch full reports with reporters and content
    const items = await Promise.all(paginatedGroups.map(async (group) => {
      const isPost = group.content_type === 'post';
      const contentId = isPost ? group.content_id_post : group.content_id_comment;

      // Fetch all reports for this content
      const reportsWhere: Record<string, unknown> = {
        content_type: group.content_type,
      };
      if (isPost) {
        reportsWhere.post_id = contentId;
      } else {
        reportsWhere.comment_id = contentId;
      }
      if (status !== 'all') {
        reportsWhere.status = status;
      }

      const reports = await Report.findAll({
        where: reportsWhere,
        include: [
          {
            model: User,
            as: 'reporter',
            attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      // Fetch content and author
      let contentPreview = '';
      let author: Record<string, unknown> | null = null;
      let contentDeleted = false;

      if (isPost) {
        const post = await Post.findByPk(contentId, {
          paranoid: false,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
            },
          ],
        });
        if (post) {
          contentPreview = (post.body || '').substring(0, 200);
          contentDeleted = !!post.deleted_at;
          const postJson = post.toJSON() as unknown as Record<string, unknown>;
          const userObj = postJson.user as Record<string, unknown> | null;
          if (userObj) {
            author = {
              id: userObj.id,
              username: userObj.username,
              display_name: userObj.display_name,
            };
          }
        }
      } else {
        const comment = await PostComment.findByPk(contentId, {
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
            },
          ],
        });
        if (comment) {
          contentPreview = (comment.body || '').substring(0, 200);
          const commentJson = comment.toJSON() as unknown as Record<string, unknown>;
          const userObj = commentJson.user as Record<string, unknown> | null;
          if (userObj) {
            author = {
              id: userObj.id,
              username: userObj.username,
              display_name: userObj.display_name,
            };
          }
        }
      }

      const reportsList = reports.map((r) => {
        const rJson = r.toJSON() as unknown as Record<string, unknown>;
        const reporter = rJson.reporter as Record<string, unknown> | null;
        return {
          id: rJson.id,
          reporter_id: reporter?.id,
          reporter_username: reporter?.username,
          reporter_display_name: reporter?.display_name,
          reason: rJson.reason,
          details: rJson.details,
          created_at: rJson.created_at,
        };
      });

      return {
        content_type: group.content_type,
        content_id: contentId,
        content_preview: contentPreview,
        content_deleted: contentDeleted,
        author,
        report_count: Number(group.report_count),
        reports: reportsList,
        status: group.status,
        first_reported_at: group.first_reported_at,
      };
    }));

    // Build cursor for next page
    const lastItem = paginatedGroups[paginatedGroups.length - 1];
    const nextCursor = hasMore && lastItem
      ? `${lastItem.report_count}:${lastItem.first_report_id}`
      : null;

    // Get counts for status tabs
    const [pendingCount, reviewedCount, dismissedCount] = await Promise.all([
      Report.count({ where: { status: 'pending' } }),
      Report.count({ where: { status: 'reviewed' } }),
      Report.count({ where: { status: 'dismissed' } }),
    ]);

    return successResponse({
      items,
      next_cursor: nextCursor,
      has_more: hasMore,
      counts: {
        pending: pendingCount,
        reviewed: reviewedCount,
        dismissed: dismissedCount,
      },
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch moderation queue');
  }
});
