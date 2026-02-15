import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/comments - List all comments with search, filtering, and pagination
 *
 * Query params:
 *   search: search comment body text (LIKE)
 *   flagged: 'true' to show only flagged comments
 *   hidden: 'true' to show only hidden, 'false' for visible only
 *   from: ISO date string for start of date range
 *   to: ISO date string for end of date range
 *   cursor: pagination cursor (comment ID)
 *   limit: items per page (default 20, max 100)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { PostComment, User, Post } = await import('@/lib/db/models');
    const { sequelize } = await import('@/lib/db');
    const url = new URL(req.url);

    const search = url.searchParams.get('search');
    const flagged = url.searchParams.get('flagged');
    const hiddenFilter = url.searchParams.get('hidden');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.body = { [Op.like]: `%${search.trim()}%` };
    }

    if (flagged === 'true') {
      where.flagged = true;
    }

    if (hiddenFilter === 'true') {
      where.hidden = true;
    } else if (hiddenFilter === 'false') {
      where.hidden = false;
    }

    if (from) {
      where.created_at = { ...(where.created_at || {}), [Op.gte]: new Date(from) };
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.created_at = { ...(where.created_at || {}), [Op.lte]: toDate };
    }

    if (cursor) {
      where.id = { ...(where.id || {}), [Op.lt]: parseInt(cursor, 10) };
    }

    const comments = await PostComment.findAll({
      where,
      attributes: {
        include: [
          [
            sequelize.literal(
              '(SELECT COUNT(*) FROM reports WHERE reports.content_type = \'comment\' AND reports.comment_id = `PostComment`.`id`)'
            ),
            'report_count',
          ],
        ],
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
        },
        {
          model: Post,
          as: 'post',
          attributes: ['id', 'body'],
          paranoid: false,
        },
      ],
      order: [['id', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = comments.length > limit;
    const paginatedComments = comments.slice(0, limit);

    const nextCursor = hasMore && paginatedComments.length > 0
      ? String(paginatedComments[paginatedComments.length - 1].id)
      : null;

    const commentList = paginatedComments.map((c) => {
      const json = c.toJSON() as unknown as Record<string, unknown>;
      const post = json.post as Record<string, unknown> | null;
      return {
        id: json.id,
        body: (json.body as string)?.substring(0, 200),
        post_id: json.post_id,
        parent_id: json.parent_id,
        flagged: json.flagged,
        hidden: json.hidden,
        edited: json.edited,
        created_at: json.created_at,
        author: json.user,
        post_preview: post ? (post.body as string)?.substring(0, 80) : null,
        report_count: parseInt(String(json.report_count || '0'), 10),
      };
    });

    return successResponse({
      comments: commentList,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch comments');
  }
});
