import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/posts - List all posts with search, filtering, and pagination
 *
 * Query params:
 *   search: search post body text (LIKE)
 *   type: filter by post_type (text, prayer_request)
 *   flagged: 'true' to show only flagged posts
 *   hidden: 'true' to show only hidden, 'false' for visible only
 *   deleted: 'true' to include soft-deleted posts
 *   from: ISO date string for start of date range
 *   to: ISO date string for end of date range
 *   cursor: pagination cursor (post ID)
 *   limit: items per page (default 20, max 100)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { Post, User, PostMedia, Report, Repost } = await import('@/lib/db/models');
    const { sequelize } = await import('@/lib/db');
    const url = new URL(req.url);

    const search = url.searchParams.get('search');
    const postType = url.searchParams.get('type');
    const flagged = url.searchParams.get('flagged');
    const hiddenFilter = url.searchParams.get('hidden');
    const deleted = url.searchParams.get('deleted');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.body = { [Op.like]: `%${search.trim()}%` };
    }

    if (postType) {
      where.post_type = postType;
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

    const posts = await Post.findAll({
      where,
      attributes: {
        include: [
          [
            sequelize.literal(
              '(SELECT COUNT(*) FROM reports WHERE reports.content_type = \'post\' AND reports.post_id = `Post`.`id`)'
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
          model: PostMedia,
          as: 'media',
          attributes: ['id', 'media_type', 'url', 'thumbnail_url'],
        },
      ],
      order: [['id', 'DESC']],
      limit: limit + 1,
      paranoid: deleted !== 'true',
    });

    const hasMore = posts.length > limit;
    const paginatedPosts = posts.slice(0, limit);

    const nextCursor = hasMore && paginatedPosts.length > 0
      ? String(paginatedPosts[paginatedPosts.length - 1].id)
      : null;

    // Look up repost info for posts that are quote reposts
    const postIds = paginatedPosts.map((p) => p.id);
    const repostRows = postIds.length > 0
      ? await Repost.findAll({
          where: { quote_post_id: { [Op.in]: postIds } },
          attributes: ['quote_post_id', 'post_id'],
          raw: true,
        })
      : [];

    // Fetch original posts for reposts
    const originalPostIds = repostRows.map((r) => r.post_id);
    let originalPostsMap = new Map<number, Record<string, unknown>>();
    if (originalPostIds.length > 0) {
      const originals = await Post.findAll({
        where: { id: { [Op.in]: originalPostIds } },
        include: [
          { model: User, as: 'user', attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'] },
          { model: PostMedia, as: 'media', attributes: ['id', 'media_type', 'url', 'thumbnail_url'] },
        ],
        paranoid: false,
      });
      for (const op of originals) {
        const oj = op.toJSON() as unknown as Record<string, unknown>;
        originalPostsMap.set(op.id, {
          id: oj.id,
          body: (oj.body as string)?.substring(0, 200),
          author: oj.user || null,
          media: Array.isArray(oj.media) ? oj.media : [],
        });
      }
    }

    // Map quote_post_id -> original post data
    const quoteToOriginal = new Map<number, Record<string, unknown>>();
    for (const row of repostRows) {
      const orig = originalPostsMap.get(row.post_id);
      if (orig) quoteToOriginal.set(row.quote_post_id, orig);
    }

    const postList = paginatedPosts.map((p) => {
      const json = p.toJSON() as unknown as Record<string, unknown>;
      return {
        id: json.id,
        body: (json.body as string)?.substring(0, 200),
        post_type: json.post_type,
        visibility: json.visibility,
        mode: json.mode,
        flagged: json.flagged,
        hidden: json.hidden,
        is_anonymous: json.is_anonymous,
        edited: json.edited,
        deleted_at: json.deleted_at,
        created_at: json.created_at,
        author: json.user,
        media: Array.isArray(json.media) ? json.media : [],
        report_count: parseInt(String(json.report_count || '0'), 10),
        original_post: quoteToOriginal.get(p.id) || null,
      };
    });

    return successResponse({
      posts: postList,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch posts');
  }
});
