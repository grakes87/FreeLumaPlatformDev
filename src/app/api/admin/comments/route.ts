import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/comments - List comments with search, filtering, and pagination
 *
 * Query params:
 *   type: 'post' (default) | 'daily' | 'verse'
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
    const {
      PostComment, DailyComment, VerseCategoryComment,
      User, Post, DailyContent, VerseCategoryContent,
    } = await import('@/lib/db/models');
    const { sequelize } = await import('@/lib/db');
    const url = new URL(req.url);

    const type = url.searchParams.get('type') || 'post';
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let comments: any[];

    if (type === 'daily') {
      comments = await DailyComment.findAll({
        where,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
          },
          {
            model: DailyContent,
            as: 'dailyContent',
            attributes: ['id', 'title', 'post_date'],
          },
        ],
        order: [['id', 'DESC']],
        limit: limit + 1,
      });
    } else if (type === 'verse') {
      comments = await VerseCategoryComment.findAll({
        where,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
          },
          {
            model: VerseCategoryContent,
            as: 'verseContent',
            attributes: ['id', 'verse_reference'],
          },
        ],
        order: [['id', 'DESC']],
        limit: limit + 1,
      });
    } else {
      // default: post
      comments = await PostComment.findAll({
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
    }

    const hasMore = comments.length > limit;
    const paginatedComments = comments.slice(0, limit);

    const nextCursor = hasMore && paginatedComments.length > 0
      ? String(paginatedComments[paginatedComments.length - 1].id)
      : null;

    const commentList = paginatedComments.map((c) => {
      const json = c.toJSON() as unknown as Record<string, unknown>;

      let contextId: number | null = null;
      let contextPreview: string | null = null;

      if (type === 'daily') {
        const dc = json.dailyContent as Record<string, unknown> | null;
        contextId = dc ? (dc.id as number) : null;
        contextPreview = dc ? `${dc.post_date} — ${(dc.title as string)?.substring(0, 60)}` : null;
      } else if (type === 'verse') {
        const vc = json.verseContent as Record<string, unknown> | null;
        contextId = vc ? (vc.id as number) : null;
        contextPreview = vc ? (vc.verse_reference as string) : null;
      } else {
        const post = json.post as Record<string, unknown> | null;
        contextId = json.post_id as number;
        contextPreview = post ? (post.body as string)?.substring(0, 80) : null;
      }

      return {
        id: json.id,
        body: (json.body as string)?.substring(0, 200),
        context_id: contextId,
        context_preview: contextPreview,
        comment_type: type,
        parent_id: json.parent_id,
        flagged: json.flagged,
        hidden: json.hidden,
        edited: json.edited,
        created_at: json.created_at,
        author: json.user,
        report_count: type === 'post' ? parseInt(String(json.report_count || '0'), 10) : 0,
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
