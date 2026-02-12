import { NextRequest, NextResponse } from 'next/server';
import { Op, literal } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { getBlockedUserIds } from '@/lib/utils/blocks';

/**
 * GET /api/feed/fyp — For You Page feed
 *
 * Returns scored public posts using a recommendation algorithm:
 *   0.4 * recency + 0.3 * engagement + 0.2 * relationship + 0.1 * category_match
 *
 * Candidate pool: last 7 days of public non-deleted posts (limit 200).
 * Scoring done in application code for flexibility.
 * Cursor pagination uses score + id compound cursor.
 */
export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  const {
    Post, PostMedia, PostReaction, PostComment,
    Bookmark, Follow, User, Repost, PlatformSetting, UserCategory,
  } = await import('@/lib/db/models');

  const userId = context.user.id;
  const url = new URL(req.url);
  const cursorParam = url.searchParams.get('cursor');
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 50);

  // 1. Get blocked user IDs
  const blockedIds = await getBlockedUserIds(userId);
  const blockedArray = Array.from(blockedIds);

  // 2. Get user's followed user IDs + followed-of-followed for relationship scoring
  const [follows, currentUser, userCategories] = await Promise.all([
    Follow.findAll({
      where: { follower_id: userId, status: 'active' },
      attributes: ['following_id'],
      raw: true,
    }),
    User.findByPk(userId, { attributes: ['id', 'mode'] }),
    UserCategory.findAll({
      where: { user_id: userId },
      attributes: ['category_id'],
      raw: true,
    }),
  ]);

  const followedIds = new Set(follows.map((f) => f.following_id));
  const userCategoryIds = new Set(userCategories.map((uc) => uc.category_id));

  // 3. Get followed-of-followed (FOF) for secondary relationship signal
  let fofIds = new Set<number>();
  if (followedIds.size > 0) {
    const fofFollows = await Follow.findAll({
      where: {
        follower_id: { [Op.in]: Array.from(followedIds) },
        status: 'active',
        following_id: { [Op.ne]: userId },
      },
      attributes: ['following_id'],
      raw: true,
    });
    fofIds = new Set(fofFollows.map((f) => f.following_id));
    // Remove direct follows from FOF (they already get higher score)
    for (const id of followedIds) fofIds.delete(id);
  }

  // 4. Build WHERE for candidate pool (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andConditions: any[] = [
    {
      post_type: 'text',
      visibility: 'public',
      created_at: { [Op.gte]: sevenDaysAgo },
    },
  ];

  if (blockedArray.length > 0) {
    andConditions.push({ user_id: { [Op.notIn]: blockedArray } });
  }

  // Mode isolation
  const modeIsolation = await PlatformSetting.get('mode_isolation_social');
  if (modeIsolation === 'true' && currentUser) {
    andConditions.push({ mode: currentUser.mode });
  }

  // 5. Fetch candidate pool with engagement counts
  const candidates = await Post.findAll({
    where: { [Op.and]: andConditions },
    order: [['created_at', 'DESC']],
    limit: 200,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
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

  if (candidates.length === 0) {
    return NextResponse.json({ posts: [], next_cursor: null, has_more: false });
  }

  // 6. Get category IDs for candidate authors (for category match scoring)
  const candidateAuthorIds = [...new Set(candidates.map((p) => p.user_id))];
  const authorCategories = await UserCategory.findAll({
    where: { user_id: { [Op.in]: candidateAuthorIds } },
    attributes: ['user_id', 'category_id'],
    raw: true,
  });
  const authorCategoryMap = new Map<number, Set<number>>();
  for (const ac of authorCategories) {
    if (!authorCategoryMap.has(ac.user_id)) {
      authorCategoryMap.set(ac.user_id, new Set());
    }
    authorCategoryMap.get(ac.user_id)!.add(ac.category_id);
  }

  // 7. Get interaction history: authors the user has reacted to or commented on
  const [reactedAuthors, commentedAuthors] = await Promise.all([
    PostReaction.findAll({
      where: { user_id: userId },
      attributes: ['post_id'],
      raw: true,
      limit: 200,
      order: [['created_at', 'DESC']],
    }).then(async (reactions) => {
      if (reactions.length === 0) return new Set<number>();
      const reactionPostIds = reactions.map((r) => r.post_id);
      const posts = await Post.findAll({
        where: { id: { [Op.in]: reactionPostIds } },
        attributes: ['user_id'],
        raw: true,
      });
      return new Set(posts.map((p) => p.user_id));
    }),
    PostComment.findAll({
      where: { user_id: userId },
      attributes: ['post_id'],
      raw: true,
      limit: 200,
      order: [['created_at', 'DESC']],
    }).then(async (comments) => {
      if (comments.length === 0) return new Set<number>();
      const commentPostIds = comments.map((c) => c.post_id);
      const posts = await Post.findAll({
        where: { id: { [Op.in]: commentPostIds } },
        attributes: ['user_id'],
        raw: true,
      });
      return new Set(posts.map((p) => p.user_id));
    }),
  ]);

  const interactedAuthors = new Set([...reactedAuthors, ...commentedAuthors]);

  // 8. Score candidates
  const now = Date.now();
  // Find max engagement for normalization
  let maxEngagement = 0;
  const candidateData = candidates.map((post) => {
    const json = post.toJSON() as unknown as Record<string, unknown>;
    const reactionCount = Number(json.reaction_count) || 0;
    const commentCount = Number(json.comment_count) || 0;
    const repostCount = Number(json.repost_count) || 0;
    const rawEngagement = reactionCount * 1 + commentCount * 2 + repostCount * 3;
    if (rawEngagement > maxEngagement) maxEngagement = rawEngagement;
    return { post, json, reactionCount, commentCount, repostCount, rawEngagement };
  });

  if (maxEngagement === 0) maxEngagement = 1; // Avoid division by zero

  const scored = candidateData.map(({ post, json, reactionCount, commentCount, repostCount, rawEngagement }) => {
    // Recency: exponential decay
    const hoursSincePost = (now - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
    const recencyScore = 1 / (1 + hoursSincePost / 24);

    // Engagement: normalized
    const engagementScore = rawEngagement / maxEngagement;

    // Relationship score
    let relationshipScore = 0;
    if (followedIds.has(post.user_id)) {
      relationshipScore = 0.3;
    } else if (fofIds.has(post.user_id)) {
      relationshipScore = 0.1;
    }

    // Interaction history
    if (interactedAuthors.has(post.user_id)) {
      relationshipScore = Math.min(relationshipScore + 0.2, 0.5);
    }

    // Category match
    let categoryScore = 0;
    const authorCats = authorCategoryMap.get(post.user_id);
    if (authorCats && userCategoryIds.size > 0) {
      let overlap = 0;
      for (const catId of authorCats) {
        if (userCategoryIds.has(catId)) overlap++;
      }
      if (authorCats.size > 0) {
        categoryScore = 0.2 * (overlap / Math.max(userCategoryIds.size, 1));
      }
    }

    // Combined score
    const score = 0.4 * recencyScore + 0.3 * engagementScore + 0.2 * relationshipScore + 0.1 * categoryScore;

    return {
      post,
      json,
      score,
      reactionCount,
      commentCount,
      repostCount,
    };
  });

  // Sort by score DESC, then id DESC for stability
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.post.id - a.post.id;
  });

  // 9. Apply cursor pagination (score + id compound cursor)
  let startIndex = 0;
  if (cursorParam) {
    const decoded = decodeFypCursor(cursorParam);
    if (decoded) {
      startIndex = scored.findIndex((item) => {
        if (item.score < decoded.score) return true;
        if (item.score === decoded.score && item.post.id < decoded.id) return true;
        return false;
      });
      if (startIndex === -1) startIndex = scored.length;
    }
  }

  const pageItems = scored.slice(startIndex, startIndex + limit + 1);
  const hasMore = pageItems.length > limit;
  const resultItems = hasMore ? pageItems.slice(0, limit) : pageItems;

  if (resultItems.length === 0) {
    return NextResponse.json({ posts: [], next_cursor: null, has_more: false });
  }

  const postIds = resultItems.map((item) => item.post.id);

  // 10. Batch lookup: user reactions + bookmarks
  const [userReactions, userBookmarks] = await Promise.all([
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
  ]);

  const reactionMap = new Map(userReactions.map((r) => [r.post_id, r.reaction_type]));
  const bookmarkSet = new Set(userBookmarks.map((b) => b.post_id));

  // 11. Batch lookup: repost info
  const repostRows = await Repost.findAll({
    where: { quote_post_id: { [Op.in]: postIds } },
    attributes: ['quote_post_id', 'post_id'],
    raw: true,
  });

  const originalPostIds = repostRows.map((r) => r.post_id);
  let originalPostsMap = new Map<number, Record<string, unknown>>();

  if (originalPostIds.length > 0) {
    const originals = await Post.findAll({
      where: { id: { [Op.in]: originalPostIds } },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
        },
        {
          model: PostMedia,
          as: 'media',
          attributes: ['id', 'media_type', 'url', 'thumbnail_url', 'width', 'height', 'duration', 'sort_order'],
          separate: true,
          order: [['sort_order', 'ASC']],
        },
      ],
      paranoid: false,
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

  const quoteToOriginalMap = new Map<number, Record<string, unknown>>();
  for (const row of repostRows) {
    const orig = originalPostsMap.get(row.post_id);
    if (orig) quoteToOriginalMap.set(row.quote_post_id, orig);
  }

  // 12. Format response
  const formatted = resultItems.map((item) => {
    const { post, json, reactionCount, commentCount, repostCount } = item;
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
      reaction_count: reactionCount,
      comment_count: commentCount,
      repost_count: repostCount,
      user_reaction: reactionMap.get(post.id) || null,
      bookmarked: bookmarkSet.has(post.id),
      original_post: quoteToOriginalMap.get(post.id) || null,
    };
  });

  // 13. Encode next cursor
  const lastItem = resultItems[resultItems.length - 1];
  const nextCursor = hasMore
    ? encodeFypCursor({ score: lastItem.score, id: lastItem.post.id })
    : null;

  return NextResponse.json({
    posts: formatted,
    next_cursor: nextCursor,
    has_more: hasMore,
  });
});

// ---- FYP cursor helpers (score + id compound) ----

function encodeFypCursor(data: { score: number; id: number }): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeFypCursor(cursor: string): { score: number; id: number } | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json);
    if (typeof parsed.score !== 'number' || typeof parsed.id !== 'number') return null;
    return { score: parsed.score, id: parsed.id };
  } catch {
    return null;
  }
}
