import { NextRequest, NextResponse } from 'next/server';
import { Op, literal } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { decodeCursor, encodeCursor } from '@/lib/utils/cursor';
import { getBlockedUserIds } from '@/lib/utils/blocks';
import { serverError } from '@/lib/utils/api';

/**
 * GET /api/feed — Following feed
 *
 * Returns posts from users the authenticated user follows (+ own posts).
 * Excludes prayer_request type, soft-deleted posts, and blocked users.
 * Respects visibility and mode isolation settings.
 * Cursor-based pagination on (created_at DESC, id DESC).
 */
export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
  const {
    Post, PostMedia, PostReaction, Bookmark,
    Follow, User, Repost, PlatformSetting,
  } = await import('@/lib/db/models');

  const userId = context.user.id;
  const url = new URL(req.url);
  const cursorParam = url.searchParams.get('cursor');
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 50);

  // 1. Get followed user IDs
  const follows = await Follow.findAll({
    where: { follower_id: userId, status: 'active' },
    attributes: ['following_id'],
    raw: true,
  });
  const followedIds = follows.map((f) => f.following_id);
  // Include own posts
  const feedUserIds = [...new Set([userId, ...followedIds])];

  // 2. Get blocked user IDs
  const blockedIds = await getBlockedUserIds(userId);
  const blockedArray = Array.from(blockedIds);

  // 3. Build WHERE as AND clauses for clean composition
  const modeIsolation = await PlatformSetting.get('mode_isolation_social');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andConditions: any[] = [
    {
      post_type: 'text',
      user_id: blockedArray.length > 0
        ? { [Op.in]: feedUserIds, [Op.notIn]: blockedArray }
        : { [Op.in]: feedUserIds },
    },
    {
      [Op.or]: [
        { visibility: 'public' },
        { visibility: 'followers', user_id: { [Op.in]: [...followedIds, userId] } },
      ],
    },
  ];

  if (modeIsolation === 'true') {
    const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
    if (currentUser) {
      andConditions.push({ mode: currentUser.mode });
    }
  }

  if (cursorParam) {
    const decoded = decodeCursor(cursorParam);
    if (decoded) {
      andConditions.push({
        [Op.or]: [
          { created_at: { [Op.lt]: new Date(decoded.created_at) } },
          {
            created_at: new Date(decoded.created_at),
            id: { [Op.lt]: decoded.id },
          },
        ],
      });
    }
  }

  // 6. Fetch posts
  const posts = await Post.findAll({
    where: { [Op.and]: andConditions },
    order: [['created_at', 'DESC'], ['id', 'DESC']],
    limit: limit + 1, // Fetch one extra to determine has_more
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified', 'status'],
        where: { status: 'active' },
        required: true,
      },
      {
        model: PostMedia,
        as: 'media',
        attributes: ['id', 'media_type', 'url', 'thumbnail_url', 'width', 'height', 'duration', 'sort_order'],
        separate: true,
        order: [['sort_order', 'ASC']],
      },
    ],
    attributes: {
      include: [
        [
          literal(`(SELECT COUNT(*) FROM post_reactions WHERE post_reactions.post_id = \`Post\`.id)`),
          'reaction_count',
        ],
        [
          literal(`(SELECT COUNT(*) FROM post_comments WHERE post_comments.post_id = \`Post\`.id)`),
          'comment_count',
        ],
        [
          literal(`(SELECT COUNT(*) FROM reposts WHERE reposts.post_id = \`Post\`.id)`),
          'repost_count',
        ],
      ],
    },
  });

  // Determine has_more
  const hasMore = posts.length > limit;
  const resultPosts = hasMore ? posts.slice(0, limit) : posts;

  if (resultPosts.length === 0) {
    return NextResponse.json({ posts: [], next_cursor: null, has_more: false });
  }

  const postIds = resultPosts.map((p) => p.id);

  // 7. Batch lookup: user reactions + bookmarks + user reposts
  const [userReactions, userBookmarks, userReposts] = await Promise.all([
    PostReaction.findAll({
      where: { user_id: userId, post_id: { [Op.in]: postIds } },
      attributes: ['post_id', 'reaction_type'],
      raw: true,
    }),
    Bookmark.findAll({
      where: { user_id: userId, post_id: { [Op.in]: postIds } },
      attributes: ['post_id'],
      raw: true,
    }),
    Repost.findAll({
      where: { user_id: userId, post_id: { [Op.in]: postIds } },
      attributes: ['post_id'],
      raw: true,
    }),
  ]);

  const reactionMap = new Map(userReactions.map((r) => [r.post_id, r.reaction_type]));
  const bookmarkSet = new Set(userBookmarks.map((b) => b.post_id));
  const userRepostedSet = new Set(userReposts.map((r) => r.post_id));

  // 8. Batch lookup: repost info (quote reposts where quote_post_id = post.id)
  const repostRows = await Repost.findAll({
    where: { quote_post_id: { [Op.in]: postIds } },
    attributes: ['quote_post_id', 'post_id'],
    raw: true,
  });

  // For any post that is a quote repost, fetch the original post data
  const originalPostIds = repostRows.map((r) => r.post_id);
  let originalPostsMap = new Map<number, Record<string, unknown>>();

  if (originalPostIds.length > 0) {
    const originals = await Post.findAll({
      where: { id: { [Op.in]: originalPostIds } },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'],
        },
        {
          model: PostMedia,
          as: 'media',
          attributes: ['id', 'media_type', 'url', 'thumbnail_url', 'width', 'height', 'duration', 'sort_order'],
          separate: true,
          order: [['sort_order', 'ASC']],
        },
      ],
      paranoid: false, // Include soft-deleted originals so we can show "[deleted]"
    });

    originalPostsMap = new Map(
      originals.map((op) => {
        const opData = op.toJSON() as unknown as Record<string, unknown>;
        return [op.id, {
          id: op.id,
          body: op.deleted_at ? '[This post has been deleted]' : opData.body,
          deleted: !!op.deleted_at,
          author: opData.user || null,
          media: opData.media || [],
        }];
      })
    );
  }

  // Map quote_post_id -> original post data
  const quoteToOriginalMap = new Map<number, Record<string, unknown>>();
  for (const row of repostRows) {
    const orig = originalPostsMap.get(row.post_id);
    if (orig) {
      quoteToOriginalMap.set(row.quote_post_id, orig);
    }
  }

  // 9. Format response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatted = resultPosts.map((post) => {
    const json = post.toJSON() as unknown as Record<string, unknown>;
    return {
      id: post.id,
      user_id: post.user_id,
      body: post.body,
      post_type: post.post_type,
      visibility: post.visibility,
      mode: post.mode,
      edited: post.edited,
      is_anonymous: post.is_anonymous,
      created_at: post.created_at,
      updated_at: post.updated_at,
      author: json.user || null,
      media: json.media || [],
      reaction_count: Number(json.reaction_count) || 0,
      comment_count: Number(json.comment_count) || 0,
      repost_count: Number(json.repost_count) || 0,
      user_reaction: reactionMap.get(post.id) || null,
      bookmarked: bookmarkSet.has(post.id),
      user_reposted: userRepostedSet.has(post.id),
      original_post: quoteToOriginalMap.get(post.id) || null,
    };
  });

  // 10. Encode next cursor
  const lastPost = resultPosts[resultPosts.length - 1];
  const nextCursor = hasMore
    ? encodeCursor({ created_at: lastPost.created_at, id: lastPost.id })
    : null;

  return NextResponse.json({
    posts: formatted,
    next_cursor: nextCursor,
    has_more: hasMore,
  });
  } catch (error) {
    return serverError(error, 'Failed to fetch feed');
  }
});
