import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';

/**
 * GET /api/admin/moderation - Moderation queue
 *
 * Query params:
 *   status: 'pending' | 'reviewed' | 'actioned' | 'dismissed' | 'all' (default 'pending')
 *   type: 'report' | 'flagged' | 'all' (default 'all')
 *   cursor: pagination cursor (report ID or flagged item key)
 *   limit: items per page (default 20, max 50)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { Report, Post, PostComment, User } = await import('@/lib/db/models');
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') || 'pending';
    const type = searchParams.get('type') || 'all';
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const items: Array<Record<string, unknown>> = [];

    // Fetch reports
    if (type === 'all' || type === 'report') {
      const reportWhere: Record<string, unknown> = {};

      if (status !== 'all') {
        reportWhere.status = status;
      }

      if (cursor) {
        reportWhere.id = { [Op.lt]: parseInt(cursor, 10) };
      }

      const reports = await Report.findAll({
        where: reportWhere,
        include: [
          {
            model: User,
            as: 'reporter',
            attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
          },
          {
            model: Post,
            as: 'post',
            paranoid: false,
            attributes: ['id', 'body', 'user_id', 'post_type', 'flagged', 'deleted_at', 'created_at'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
              },
            ],
          },
        ],
        order: [['created_at', 'DESC']],
        limit: limit + 1,
      });

      // For comment reports, fetch the comment separately
      for (const report of reports) {
        const r = report.toJSON() as unknown as Record<string, unknown>;
        let commentData = null;

        if (r.content_type === 'comment' && r.comment_id) {
          const comment = await PostComment.findByPk(r.comment_id as number, {
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
              },
            ],
          });
          if (comment) {
            commentData = comment.toJSON();
          }
        }

        items.push({
          ...r,
          item_type: 'report',
          comment: commentData,
        });
      }
    }

    // Fetch flagged posts/comments (not already in a report that was actioned)
    if (type === 'all' || type === 'flagged') {
      // Only show flagged items when viewing pending or all statuses
      if (status === 'pending' || status === 'all') {
        const flaggedPosts = await Post.findAll({
          where: { flagged: true },
          paranoid: false,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
            },
          ],
          order: [['created_at', 'DESC']],
          limit,
        });

        for (const post of flaggedPosts) {
          items.push({
            id: `flagged_post_${post.id}`,
            item_type: 'flagged_post',
            content_type: 'post',
            post: post.toJSON(),
            reason: 'profanity_filter',
            created_at: post.created_at,
          });
        }

        const flaggedComments = await PostComment.findAll({
          where: { flagged: true },
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
            },
          ],
          order: [['created_at', 'DESC']],
          limit,
        });

        for (const comment of flaggedComments) {
          items.push({
            id: `flagged_comment_${comment.id}`,
            item_type: 'flagged_comment',
            content_type: 'comment',
            comment: comment.toJSON(),
            reason: 'profanity_filter',
            created_at: comment.created_at,
          });
        }
      }
    }

    // Sort combined items by created_at DESC
    items.sort((a, b) => {
      const dateA = new Date(a.created_at as string).getTime();
      const dateB = new Date(b.created_at as string).getTime();
      return dateB - dateA;
    });

    // Apply limit
    const hasMore = items.length > limit;
    const paginatedItems = items.slice(0, limit);
    const nextCursor = paginatedItems.length > 0
      ? String((paginatedItems[paginatedItems.length - 1] as Record<string, unknown>).id)
      : null;

    // Get counts for status tabs
    const pendingCount = await Report.count({ where: { status: 'pending' } });
    const reviewedCount = await Report.count({ where: { status: 'reviewed' } });
    const actionedCount = await Report.count({ where: { status: 'actioned' } });

    return successResponse({
      items: paginatedItems,
      next_cursor: hasMore ? nextCursor : null,
      has_more: hasMore,
      counts: {
        pending: pendingCount,
        reviewed: reviewedCount,
        actioned: actionedCount,
      },
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch moderation queue');
  }
});
