import { NextRequest } from 'next/server';
import { Op, fn, col, where as seqWhere, literal } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { getBlockedUserIds } from '@/lib/utils/blocks';
import { encodeCursor, decodeCursor } from '@/lib/utils/cursor';

/**
 * GET /api/users/[username]/profile — Public profile data with stats
 *
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
    const username = params.username;

    if (!username) {
      return errorResponse('Username is required', 400);
    }

    const {
      User, Post, PostMedia, PostReaction, PostComment,
      Follow, Block, Bookmark, Repost,
    } = await import('@/lib/db/models');

    // Case-insensitive username lookup
    const targetUser = await User.findOne({
      where: seqWhere(fn('LOWER', col('username')), username.toLowerCase()),
      attributes: [
        'id', 'username', 'display_name', 'bio', 'avatar_url', 'avatar_color',
        'profile_privacy', 'mode', 'denomination', 'church', 'location',
        'website', 'date_of_birth', 'created_at',
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
    const [postCount, followerCount, followingCount] = await Promise.all([
      Post.count({
        where: {
          user_id: targetId,
          deleted_at: null,
          post_type: 'text', // exclude prayer_request from profile post count
        },
      }),
      Follow.count({
        where: { following_id: targetId, status: 'active' },
      }),
      Follow.count({
        where: { follower_id: targetId, status: 'active' },
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

    // Build user data
    const userData: Record<string, unknown> = {
      id: targetUser.id,
      username: targetUser.username,
      display_name: targetUser.display_name,
      bio: targetUser.bio,
      avatar_url: targetUser.avatar_url,
      avatar_color: targetUser.avatar_color,
      profile_privacy: targetUser.profile_privacy,
      mode: targetUser.mode,
      denomination: targetUser.denomination,
      church: targetUser.church,
      location: targetUser.location,
      website: targetUser.website,
      created_at: targetUser.created_at,
    };

    // Only include date_of_birth for own profile
    if (isSelf) {
      userData.date_of_birth = targetUser.date_of_birth;
    }

    const stats = {
      post_count: postCount,
      follower_count: followerCount,
      following_count: followingCount,
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
          bio: targetUser.bio,
          profile_privacy: targetUser.profile_privacy,
        },
        stats,
        relationship,
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
      };

      // Non-self: only show public posts (or followers-only if following)
      if (!isSelf) {
        whereClause.visibility = isFollowing
          ? { [Op.in]: ['public', 'followers'] }
          : 'public';
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
            attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
          },
          {
            model: PostMedia,
            as: 'media',
            attributes: ['id', 'url', 'media_type', 'thumbnail_url', 'width', 'height', 'sort_order'],
          },
        ],
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit: limit + 1,
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

      // Get reaction + comment counts
      const [reactionCounts, commentCounts, repostCounts] = await Promise.all([
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

      posts = {
        items: items.map((p) => ({
          ...p.toJSON(),
          reaction_count: reactionMap[p.id] || 0,
          comment_count: commentMap[p.id] || 0,
          repost_count: repostMap[p.id] || 0,
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
            attributes: ['id', 'user_id', 'body', 'post_type', 'visibility', 'mode', 'created_at'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
              },
            ],
          },
          {
            model: Post,
            as: 'originalPost',
            attributes: ['id', 'user_id', 'body', 'post_type', 'visibility', 'mode', 'created_at'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
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

      const hasMore = repostRows.length > limit;
      const items = hasMore ? repostRows.slice(0, limit) : repostRows;

      if (hasMore && items.length > 0) {
        const last = items[items.length - 1];
        nextCursor = encodeCursor({ created_at: last.created_at, id: last.id });
      }

      posts = {
        items: items.map((r) => r.toJSON()),
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
                attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
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

      posts = {
        items: items.map((b) => b.toJSON()),
        next_cursor: bookmarkNextCursor,
        has_more: hasMore,
      };
    }

    return successResponse({
      user: userData,
      stats,
      relationship,
      posts,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch profile');
  }
});
