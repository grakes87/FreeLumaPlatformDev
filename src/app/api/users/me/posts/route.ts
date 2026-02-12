import { NextRequest } from 'next/server';
import { Op, fn, col, literal } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Post,
  PostMedia,
  PostReaction,
  PostComment,
  Bookmark,
  User,
  Repost,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/users/me/posts — Get authenticated user's posts
 *
 * Query params:
 *   - cursor: ID-based cursor for pagination
 *   - limit: Number of posts (max 50, default 20)
 *   - include_reposts: If 'true', also include quote reposts by this user
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const cursor = searchParams.get('cursor');
      const limit = Math.min(
        parseInt(searchParams.get('limit') || '20', 10),
        50
      );
      const includeReposts = searchParams.get('include_reposts') === 'true';

      const userId = context.user.id;

      // Build where clause
      const where: Record<string, unknown> = {
        user_id: userId,
      };

      if (!includeReposts) {
        where.post_type = 'text';
      }

      if (cursor) {
        const cursorId = parseInt(cursor, 10);
        if (!isNaN(cursorId)) {
          where.id = { [Op.lt]: cursorId };
        }
      }

      const posts = await Post.findAll({
        where,
        order: [['id', 'DESC']],
        limit: limit + 1,
        include: [
          {
            model: User,
            as: 'user',
            attributes: [
              'id',
              'username',
              'display_name',
              'avatar_url',
              'avatar_color',
            ],
          },
          {
            model: PostMedia,
            as: 'media',
            attributes: [
              'id',
              'media_type',
              'url',
              'thumbnail_url',
              'width',
              'height',
              'duration',
              'sort_order',
            ],
          },
        ],
      });

      const hasMore = posts.length > limit;
      const items = hasMore ? posts.slice(0, limit) : posts;

      // Batch fetch reaction counts, comment counts, and bookmark status
      const postIds = items.map((p) => p.id);

      // Reaction counts per post
      const reactionCountRows = postIds.length > 0
        ? await PostReaction.findAll({
            where: { post_id: { [Op.in]: postIds } },
            attributes: [
              'post_id',
              [fn('COUNT', col('id')), 'count'],
            ],
            group: ['post_id'],
            raw: true,
          }) as unknown as { post_id: number; count: string }[]
        : [];

      const reactionMap = new Map<number, number>();
      for (const row of reactionCountRows) {
        reactionMap.set(row.post_id, parseInt(row.count, 10));
      }

      // Comment counts per post
      const commentCountRows = postIds.length > 0
        ? await PostComment.findAll({
            where: { post_id: { [Op.in]: postIds } },
            attributes: [
              'post_id',
              [fn('COUNT', col('id')), 'count'],
            ],
            group: ['post_id'],
            raw: true,
          }) as unknown as { post_id: number; count: string }[]
        : [];

      const commentMap = new Map<number, number>();
      for (const row of commentCountRows) {
        commentMap.set(row.post_id, parseInt(row.count, 10));
      }

      // Bookmark status
      const bookmarkedRows = postIds.length > 0
        ? await Bookmark.findAll({
            where: {
              user_id: userId,
              post_id: { [Op.in]: postIds },
            },
            attributes: ['post_id'],
            raw: true,
          }) as unknown as { post_id: number }[]
        : [];

      const bookmarkedSet = new Set(bookmarkedRows.map((b) => b.post_id));

      // User's own reactions
      const userReactionRows = postIds.length > 0
        ? await PostReaction.findAll({
            where: {
              user_id: userId,
              post_id: { [Op.in]: postIds },
            },
            attributes: ['post_id', 'reaction_type'],
            raw: true,
          }) as unknown as { post_id: number; reaction_type: string }[]
        : [];

      const userReactionMap = new Map<number, string>();
      for (const row of userReactionRows) {
        userReactionMap.set(row.post_id, row.reaction_type);
      }

      // Build response
      const enrichedPosts = items.map((post) => {
        const postJson = post.toJSON() as unknown as Record<string, unknown>;
        return {
          ...postJson,
          reaction_count: reactionMap.get(post.id) || 0,
          comment_count: commentMap.get(post.id) || 0,
          bookmarked: bookmarkedSet.has(post.id),
          user_reaction: userReactionMap.get(post.id) ?? null,
        };
      });

      const nextCursor = items.length > 0
        ? String(items[items.length - 1].id)
        : null;

      return successResponse({
        posts: enrichedPosts,
        next_cursor: hasMore ? nextCursor : null,
        has_more: hasMore,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch user posts');
    }
  }
);
