import { NextRequest } from 'next/server';
import { Op, fn, col, where as seqWhere, literal } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { getBlockedUserIds } from '@/lib/utils/blocks';
import { encodeCursor, decodeCursor } from '@/lib/utils/cursor';

/**
 * GET /api/users/[id]/profile — Public profile data with stats
 *
 * The [id] param receives a username string (Next.js dynamic segment).
 * - Resolves user by username (case-insensitive)
 * - Block check: if blocked/blocking, return 404
 * - Computes stats: post_count, follower_count, following_count
 * - Determines relationship: 'self' | 'following' | 'pending' | 'none' | 'follows_you'
 * - Privacy gate: private profiles show limited data to non-followers
 * - If authorized: includes recent posts (first page, 20 items) with cursor
 */
export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const username = params.id; // [id] segment receives the username

    if (!username) {
      return errorResponse('Username is required', 400);
    }

    const {
      User, Post, PostMedia, PostReaction, PostComment,
      Follow, Block, Bookmark, Repost, PostImpression, UserSetting,
    } = await import('@/lib/db/models');

    // Case-insensitive username lookup
    const targetUser = await User.findOne({
      where: seqWhere(fn('LOWER', col('username')), username.toLowerCase()),
      attributes: [
        'id', 'username', 'display_name', 'bio', 'avatar_url', 'avatar_color',
        'is_verified', 'profile_privacy', 'mode', 'denomination', 'church', 'location',
        'website', 'date_of_birth', 'created_at', 'status',
      ],
    });

    if (!targetUser) {
      return errorResponse('User not found', 404);
    }

    const targetId = targetUser.id;
    const currentUserId = context.user.id;
    const isSelf = targetId === currentUserId;

    // Block check: if blocked in either direction, return 404
    if (!isSelf) {
      const blockedIds = await getBlockedUserIds(currentUserId);
      if (blockedIds.has(targetId)) {
        return errorResponse('User not found', 404);
      }
    }

    // Compute stats
    const [postCount, followerCount, followingCount, likeCount, viewCount] = await Promise.all([
      Post.count({
        where: {
          user_id: targetId,
          deleted_at: null,
          post_type: 'text',
          // Exclude quote posts from post count (they show under reposts)
          id: { [Op.notIn]: literal(`(SELECT quote_post_id FROM reposts WHERE user_id = ${Number(targetId)})`) },
        },
      }),
      Follow.count({
        where: { following_id: targetId, status: 'active' },
      }),
      Follow.count({
        where: { follower_id: targetId, status: 'active' },
      }),
      PostReaction.count({
        include: [{
          model: Post,
          as: 'post',
          attributes: [],
          where: { user_id: targetId, deleted_at: null },
        }],
      }),
      PostImpression.count({
        include: [{
          model: Post,
          as: 'post',
          attributes: [],
          where: { user_id: targetId, deleted_at: null },
        }],
      }),
    ]);

    // Determine relationship
    let relationship: 'self' | 'following' | 'pending' | 'none' | 'follows_you' = 'none';

    if (isSelf) {
      relationship = 'self';
    } else {
      // Check if current user follows target
      const myFollow = await Follow.findOne({
        where: { follower_id: currentUserId, following_id: targetId },
        attributes: ['status'],
      });

      if (myFollow) {
        relationship = myFollow.status === 'active' ? 'following' : 'pending';
      } else {
        // Check if target follows current user
        const theirFollow = await Follow.findOne({
          where: { follower_id: targetId, following_id: currentUserId, status: 'active' },
          attributes: ['id'],
        });

        if (theirFollow) {
          relationship = 'follows_you';
        }
      }
    }

    // Fetch messaging access setting for the target user
    let messagingAccess: string = 'mutual';
    if (!isSelf) {
      const targetSettings = await UserSetting.findOne({
        where: { user_id: targetId },
        attributes: ['messaging_access'],
      });
      if (targetSettings) {
        messagingAccess = targetSettings.messaging_access;
      }
    }

    // Build user data
    const userData: Record<string, unknown> = {
      id: targetUser.id,
      username: targetUser.username,
      display_name: targetUser.display_name,
      bio: targetUser.bio,
      avatar_url: targetUser.avatar_url,
      avatar_color: targetUser.avatar_color,
      is_verified: targetUser.is_verified,
      profile_privacy: targetUser.profile_privacy,
      mode: targetUser.mode,
      denomination: targetUser.denomination,
      church: targetUser.church,
      location: targetUser.location,
      website: targetUser.website,
      created_at: targetUser.created_at,
      status: targetUser.status,
    };

    // Only include date_of_birth for own profile
    if (isSelf) {
      userData.date_of_birth = targetUser.date_of_birth;
    }

    const stats = {
      post_count: postCount,
      follower_count: followerCount,
      following_count: followingCount,
      like_count: likeCount,
      view_count: viewCount,
    };

    // Privacy gate: private profile + not self + not following + not admin
    const isPrivate = targetUser.profile_privacy === 'private';
    const isFollowing = relationship === 'following';

    if (isPrivate && !isSelf && !isFollowing) {
      // Return limited data - no posts
      return successResponse({
        user: {
          id: targetUser.id,
          username: targetUser.username,
          display_name: targetUser.display_name,
          avatar_url: targetUser.avatar_url,
          avatar_color: targetUser.avatar_color,
          is_verified: targetUser.is_verified,
          bio: targetUser.bio,
          profile_privacy: targetUser.profile_privacy,
        },
        stats,
        relationship,
        messaging_access: messagingAccess,
        posts: null,
      });
    }

    // Authorized: include recent posts (first page)
    const url = new URL(req.url);
    const cursorParam = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
    const tab = url.searchParams.get('tab') || 'posts';

    let posts = null;
    let nextCursor: string | null = null;

    if (tab === 'posts') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = {
        user_id: targetId,
        post_type: 'text',
        deleted_at: null,
        // Exclude quote posts (those belong in the reposts tab)
        id: { [Op.notIn]: literal(`(SELECT quote_post_id FROM reposts WHERE user_id = ${Number(targetId)})`) },
      };

      // Non-self: only show public posts (or followers-only if following)
      if (!isSelf) {
        whereClause.visibility = isFollowing
          ? { [Op.in]: ['public', 'followers'] }
          : 'public';
        // Hidden posts only visible to original poster + repost participants
        whereClause[Op.and] = [
          literal(
            `(\`Post\`.\`hidden\` = 0 OR \`Post\`.\`user_id\` = ${currentUserId}` +
            ` OR \`Post\`.\`id\` IN (SELECT r.post_id FROM reposts r WHERE r.user_id = ${currentUserId})` +
            ` OR \`Post\`.\`id\` IN (SELECT r.quote_post_id FROM reposts r INNER JOIN posts p ON r.post_id = p.id WHERE p.user_id = ${currentUserId}))`
          ),
        ];
      }

      if (cursorParam) {
        const decoded = decodeCursor(cursorParam);
        if (decoded) {
          whereClause[Op.or] = [
            { created_at: { [Op.lt]: decoded.created_at } },
            { created_at: decoded.created_at, id: { [Op.lt]: decoded.id } },
          ];
        }
      }

      const postRows = await Post.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'],
          },
          {
            model: PostMedia,
            as: 'media',
            attributes: ['id', 'url', 'media_type', 'thumbnail_url', 'width', 'height', 'sort_order'],
          },
        ],
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit: limit + 1,
        subQuery: false,
      });

      const hasMore = postRows.length > limit;
      const items = hasMore ? postRows.slice(0, limit) : postRows;

      if (hasMore && items.length > 0) {
        const last = items[items.length - 1];
        nextCursor = encodeCursor({ created_at: last.created_at, id: last.id });
      }

      // Batch lookup user's reactions and bookmarks for these posts
      const postIds = items.map((p) => p.id);
      let userReactions: Record<number, string> = {};
      let userBookmarks: Set<number> = new Set();

      if (postIds.length > 0) {
        const [reactions, bookmarks] = await Promise.all([
          PostReaction.findAll({
            where: { user_id: currentUserId, post_id: { [Op.in]: postIds } },
            attributes: ['post_id', 'reaction_type'],
            raw: true,
          }),
          Bookmark.findAll({
            where: { user_id: currentUserId, post_id: { [Op.in]: postIds } },
            attributes: ['post_id'],
            raw: true,
          }),
        ]);

        userReactions = Object.fromEntries(reactions.map((r) => [r.post_id, r.reaction_type]));
        userBookmarks = new Set(bookmarks.map((b) => b.post_id).filter((id): id is number => id !== null));
      }

      // Get reaction + comment + impression counts
      const [reactionCounts, commentCounts, repostCounts, impressionCounts] = await Promise.all([
        postIds.length > 0
          ? PostReaction.count({
              where: { post_id: { [Op.in]: postIds } },
              group: ['post_id'],
            })
          : [],
        postIds.length > 0
          ? PostComment.count({
              where: { post_id: { [Op.in]: postIds } },
              group: ['post_id'],
            })
          : [],
        postIds.length > 0
          ? Repost.count({
              where: { post_id: { [Op.in]: postIds } },
              group: ['post_id'],
            })
          : [],
        postIds.length > 0
          ? PostImpression.count({
              where: { post_id: { [Op.in]: postIds } },
              group: ['post_id'],
            })
          : [],
      ]);

      const reactionMap = Object.fromEntries(
        (reactionCounts as Array<{ post_id: number; count: number }>).map((r) => [r.post_id, Number(r.count)])
      );
      const commentMap = Object.fromEntries(
        (commentCounts as Array<{ post_id: number; count: number }>).map((c) => [c.post_id, Number(c.count)])
      );
      const repostMap = Object.fromEntries(
        (repostCounts as Array<{ post_id: number; count: number }>).map((r) => [r.post_id, Number(r.count)])
      );
      const impressionMap = Object.fromEntries(
        (impressionCounts as Array<{ post_id: number; count: number }>).map((i) => [i.post_id, Number(i.count)])
      );

      posts = {
        items: items.map((p) => ({
          ...p.toJSON(),
          reaction_count: reactionMap[p.id] || 0,
          comment_count: commentMap[p.id] || 0,
          repost_count: repostMap[p.id] || 0,
          view_count: impressionMap[p.id] || 0,
          user_reaction: userReactions[p.id] || null,
          is_bookmarked: userBookmarks.has(p.id),
        })),
        next_cursor: nextCursor,
        has_more: hasMore,
      };
    } else if (tab === 'reposts') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repostWhere: any = { user_id: targetId };

      if (cursorParam) {
        const decoded = decodeCursor(cursorParam);
        if (decoded) {
          repostWhere[Op.or] = [
            { created_at: { [Op.lt]: decoded.created_at } },
            { created_at: decoded.created_at, id: { [Op.lt]: decoded.id } },
          ];
        }
      }

      const repostRows = await Repost.findAll({
        where: repostWhere,
        include: [
          {
            model: Post,
            as: 'quotePost',
            attributes: ['id', 'user_id', 'body', 'post_type', 'visibility', 'mode', 'hidden', 'created_at'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'],
              },
              {
                model: PostMedia,
                as: 'media',
                attributes: ['id', 'url', 'media_type', 'thumbnail_url', 'width', 'height', 'sort_order'],
              },
            ],
          },
          {
            model: Post,
            as: 'originalPost',
            attributes: ['id', 'user_id', 'body', 'post_type', 'visibility', 'mode', 'hidden', 'created_at'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'],
              },
              {
                model: PostMedia,
                as: 'media',
                attributes: ['id', 'url', 'media_type', 'thumbnail_url', 'width', 'height', 'sort_order'],
              },
            ],
          },
        ],
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit: limit + 1,
      });

      // Filter out hidden reposts for non-participants
      const filteredReposts = isSelf ? repostRows : repostRows.filter((r) => {
        const json = r.toJSON() as unknown as Record<string, unknown>;
        const qp = json.quotePost as { hidden?: boolean; user_id?: number } | null;
        const op = json.originalPost as { hidden?: boolean; user_id?: number } | null;
        // If the quote post is hidden, only show to original poster or reposter
        if (qp?.hidden && qp.user_id !== currentUserId && r.user_id !== currentUserId) {
          // Also allow if the original post author is the current user
          if (op?.user_id !== currentUserId) return false;
        }
        // If the original post is hidden, only show to its author or the reposter
        if (op?.hidden && op.user_id !== currentUserId && r.user_id !== currentUserId) return false;
        return true;
      });

      const hasMore = filteredReposts.length > limit;
      const items = hasMore ? filteredReposts.slice(0, limit) : filteredReposts;

      if (hasMore && items.length > 0) {
        const last = items[items.length - 1];
        nextCursor = encodeCursor({ created_at: last.created_at, id: last.id });
      }

      // Collect resolved post IDs (originalPost preferred, then quotePost) for reaction counts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repostJsonItems = items.map((r) => r.toJSON() as any as Record<string, unknown>);
      // Collect ALL nested post IDs (both originalPost and quotePost) for counts
      const allNestedPostIds: number[] = [];
      for (const r of repostJsonItems) {
        const orig = r.originalPost as { id: number } | null;
        const quote = r.quotePost as { id: number } | null;
        if (orig?.id) allNestedPostIds.push(orig.id);
        if (quote?.id) allNestedPostIds.push(quote.id);
      }
      const repostPostIds = [...new Set(allNestedPostIds)];

      let repostReactionMap: Record<number, number> = {};
      let repostImpressionMap: Record<number, number> = {};
      let repostCommentMap: Record<number, number> = {};
      let repostRepostMap: Record<number, number> = {};
      if (repostPostIds.length > 0) {
        const [rCounts, iCounts, cCounts, rpCounts] = await Promise.all([
          PostReaction.count({
            where: { post_id: { [Op.in]: repostPostIds } },
            group: ['post_id'],
          }),
          PostImpression.count({
            where: { post_id: { [Op.in]: repostPostIds } },
            group: ['post_id'],
          }),
          PostComment.count({
            where: { post_id: { [Op.in]: repostPostIds } },
            group: ['post_id'],
          }),
          Repost.count({
            where: { post_id: { [Op.in]: repostPostIds } },
            group: ['post_id'],
          }),
        ]);
        repostReactionMap = Object.fromEntries(
          (rCounts as Array<{ post_id: number; count: number }>).map((c) => [c.post_id, Number(c.count)])
        );
        repostImpressionMap = Object.fromEntries(
          (iCounts as Array<{ post_id: number; count: number }>).map((c) => [c.post_id, Number(c.count)])
        );
        repostCommentMap = Object.fromEntries(
          (cCounts as Array<{ post_id: number; count: number }>).map((c) => [c.post_id, Number(c.count)])
        );
        repostRepostMap = Object.fromEntries(
          (rpCounts as Array<{ post_id: number; count: number }>).map((c) => [c.post_id, Number(c.count)])
        );
      }

      posts = {
        items: repostJsonItems.map((json) => {
          if (json.originalPost) {
            const op = json.originalPost as Record<string, unknown>;
            op.reaction_count = repostReactionMap[op.id as number] || 0;
            op.comment_count = repostCommentMap[op.id as number] || 0;
            op.repost_count = repostRepostMap[op.id as number] || 0;
            op.view_count = repostImpressionMap[op.id as number] || 0;
          }
          if (json.quotePost) {
            const qp = json.quotePost as Record<string, unknown>;
            qp.reaction_count = repostReactionMap[qp.id as number] || 0;
            qp.comment_count = repostCommentMap[qp.id as number] || 0;
            qp.repost_count = repostRepostMap[qp.id as number] || 0;
            qp.view_count = repostImpressionMap[qp.id as number] || 0;
          }
          return json;
        }),
        next_cursor: nextCursor,
        has_more: hasMore,
      };
    } else if (tab === 'saved' && isSelf) {
      // Saved tab: only for own profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bookmarkWhere: any = {
        user_id: currentUserId,
        post_id: { [Op.ne]: null },
      };

      if (cursorParam) {
        bookmarkWhere.id = { [Op.lt]: parseInt(cursorParam, 10) };
      }

      const bookmarkRows = await Bookmark.findAll({
        where: bookmarkWhere,
        include: [
          {
            model: Post,
            as: 'post',
            attributes: ['id', 'user_id', 'body', 'post_type', 'visibility', 'mode', 'created_at'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'],
              },
              {
                model: PostMedia,
                as: 'media',
                attributes: ['id', 'url', 'media_type', 'thumbnail_url', 'width', 'height', 'sort_order'],
              },
            ],
          },
        ],
        order: [['id', 'DESC']],
        limit: limit + 1,
      });

      const hasMore = bookmarkRows.length > limit;
      const items = hasMore ? bookmarkRows.slice(0, limit) : bookmarkRows;
      const bookmarkNextCursor = hasMore && items.length > 0
        ? items[items.length - 1].id.toString()
        : null;

      // Collect saved post IDs for counts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const savedJsonItems = items.map((b) => b.toJSON() as any as Record<string, unknown>);
      const savedPostIds = savedJsonItems
        .map((b) => {
          const p = b.post as { id: number } | null;
          return p?.id;
        })
        .filter((id): id is number => !!id);

      let savedReactionMap: Record<number, number> = {};
      let savedImpressionMap: Record<number, number> = {};
      let savedCommentMap: Record<number, number> = {};
      let savedRepostMap: Record<number, number> = {};
      if (savedPostIds.length > 0) {
        const [rCounts, iCounts, cCounts, rpCounts] = await Promise.all([
          PostReaction.count({
            where: { post_id: { [Op.in]: savedPostIds } },
            group: ['post_id'],
          }),
          PostImpression.count({
            where: { post_id: { [Op.in]: savedPostIds } },
            group: ['post_id'],
          }),
          PostComment.count({
            where: { post_id: { [Op.in]: savedPostIds } },
            group: ['post_id'],
          }),
          Repost.count({
            where: { post_id: { [Op.in]: savedPostIds } },
            group: ['post_id'],
          }),
        ]);
        savedReactionMap = Object.fromEntries(
          (rCounts as Array<{ post_id: number; count: number }>).map((c) => [c.post_id, Number(c.count)])
        );
        savedImpressionMap = Object.fromEntries(
          (iCounts as Array<{ post_id: number; count: number }>).map((c) => [c.post_id, Number(c.count)])
        );
        savedCommentMap = Object.fromEntries(
          (cCounts as Array<{ post_id: number; count: number }>).map((c) => [c.post_id, Number(c.count)])
        );
        savedRepostMap = Object.fromEntries(
          (rpCounts as Array<{ post_id: number; count: number }>).map((c) => [c.post_id, Number(c.count)])
        );
      }

      posts = {
        items: savedJsonItems.map((json) => {
          if (json.post) {
            const p = json.post as Record<string, unknown>;
            p.reaction_count = savedReactionMap[p.id as number] || 0;
            p.comment_count = savedCommentMap[p.id as number] || 0;
            p.repost_count = savedRepostMap[p.id as number] || 0;
            p.view_count = savedImpressionMap[p.id as number] || 0;
          }
          return json;
        }),
        next_cursor: bookmarkNextCursor,
        has_more: hasMore,
      };
    }

    return successResponse({
      user: userData,
      stats,
      relationship,
      messaging_access: messagingAccess,
      posts,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch profile');
  }
});
