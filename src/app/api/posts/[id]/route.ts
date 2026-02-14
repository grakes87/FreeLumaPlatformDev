import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Post,
  PostMedia,
  PostReaction,
  PostComment,
  Bookmark,
  PrayerRequest,
  User,
  Follow,
} from '@/lib/db/models';
import { getBlockedUserIds } from '@/lib/utils/blocks';
import { checkAndFlag } from '@/lib/moderation/profanity';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { fn, col } from 'sequelize';

const POST_BODY_MAX = 5000;

const mediaItemSchema = z.object({
  url: z.string().url(),
  media_type: z.enum(['image', 'video']),
  thumbnail_url: z.string().url().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

const updatePostSchema = z.object({
  body: z.string().min(1).max(POST_BODY_MAX).optional(),
  visibility: z.enum(['public', 'followers']).optional(),
  media: z.array(mediaItemSchema).max(10).optional(),
});

/**
 * GET /api/posts/[id] — Get post detail with enriched data
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const postId = parseInt(params.id, 10);
      if (isNaN(postId)) {
        return errorResponse('Invalid post ID');
      }

      const userId = context.user.id;

      const post = await Post.findByPk(postId, {
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
          },
          {
            model: PrayerRequest,
            as: 'prayerRequest',
          },
        ],
      });

      if (!post) {
        return errorResponse('Post not found', 404);
      }

      // Block check — prevent viewing posts from blocked users
      const blockedIds = await getBlockedUserIds(userId);
      if (blockedIds.has(post.user_id)) {
        return errorResponse('Post not found', 404);
      }

      // Visibility check — followers-only posts require following
      if (post.visibility === 'followers' && post.user_id !== userId) {
        const isFollowing = await Follow.findOne({
          where: {
            follower_id: userId,
            following_id: post.user_id,
            status: 'active',
          },
        });
        if (!isFollowing) {
          return errorResponse('This post is only visible to followers', 403);
        }
      }

      // Get reaction counts per type
      const reactionRows = await PostReaction.findAll({
        where: { post_id: postId },
        attributes: [
          'reaction_type',
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['reaction_type'],
        raw: true,
      }) as unknown as { reaction_type: string; count: string }[];

      const reactionCounts: Record<string, number> = {};
      let totalReactions = 0;
      for (const row of reactionRows) {
        const c = parseInt(row.count, 10);
        reactionCounts[row.reaction_type] = c;
        totalReactions += c;
      }

      // Get comment count
      const commentCount = await PostComment.count({
        where: { post_id: postId },
      });

      // Get user's own reaction (if any)
      const userReaction = await PostReaction.findOne({
        where: { user_id: userId, post_id: postId },
        attributes: ['reaction_type'],
      });

      // Get user's bookmark status
      const userBookmark = await Bookmark.findOne({
        where: { user_id: userId, post_id: postId },
        attributes: ['id'],
      });

      // Build response — use Record to allow association fields from includes
      const postData = post.toJSON() as unknown as Record<string, unknown>;

      // Mask author info if anonymous (and viewer is not the author)
      if (post.is_anonymous && post.user_id !== userId) {
        postData.user = {
          id: 0,
          username: 'anonymous',
          display_name: 'Anonymous',
          avatar_url: null,
          avatar_color: '#6B7280',
        };
      }

      return successResponse({
        ...postData,
        reaction_counts: reactionCounts,
        total_reactions: totalReactions,
        comment_count: commentCount,
        user_reaction: userReaction?.reaction_type ?? null,
        is_bookmarked: !!userBookmark,
        is_own: post.user_id === userId,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch post');
    }
  }
);

/**
 * PUT /api/posts/[id] — Edit a post
 */
export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const postId = parseInt(params.id, 10);
      if (isNaN(postId)) {
        return errorResponse('Invalid post ID');
      }

      const json = await req.json();
      const parsed = updatePostSchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const userId = context.user.id;
      const post = await Post.findByPk(postId);

      if (!post) {
        return errorResponse('Post not found', 404);
      }

      // Only the author can edit
      if (post.user_id !== userId) {
        return errorResponse('You can only edit your own posts', 403);
      }

      const updates: Partial<{
        body: string;
        visibility: 'public' | 'followers';
        edited: boolean;
        flagged: boolean;
      }> = {};

      if (parsed.data.body !== undefined) {
        const profanityResult = checkAndFlag(parsed.data.body);
        updates.body = parsed.data.body;
        updates.flagged = profanityResult.flagged;
        updates.edited = true;
      }

      if (parsed.data.visibility !== undefined) {
        updates.visibility = parsed.data.visibility;
        if (!updates.body) {
          updates.edited = true;
        }
      }

      await post.update(updates);

      // Replace media if provided
      if (parsed.data.media !== undefined) {
        await PostMedia.destroy({ where: { post_id: postId } });
        if (parsed.data.media.length > 0) {
          await PostMedia.bulkCreate(
            parsed.data.media.map((m, index) => ({
              post_id: postId,
              media_type: m.media_type,
              url: m.url,
              thumbnail_url: m.thumbnail_url ?? null,
              width: m.width ?? null,
              height: m.height ?? null,
              duration: m.duration ?? null,
              sort_order: m.sort_order ?? index,
            }))
          );
        }
      }

      // Reload with associations
      const updated = await Post.findByPk(postId, {
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
          },
          {
            model: PrayerRequest,
            as: 'prayerRequest',
          },
        ],
      });

      return successResponse(updated);
    } catch (error) {
      return serverError(error, 'Failed to update post');
    }
  }
);

/**
 * DELETE /api/posts/[id] — Soft delete a post (paranoid mode)
 */
export const DELETE = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const postId = parseInt(params.id, 10);
      if (isNaN(postId)) {
        return errorResponse('Invalid post ID');
      }

      const userId = context.user.id;
      const post = await Post.findByPk(postId);

      if (!post) {
        return errorResponse('Post not found', 404);
      }

      // Author or admin can delete
      if (post.user_id !== userId) {
        // Check admin status
        const user = await User.findByPk(userId, { attributes: ['id', 'is_admin'] });
        if (!user?.is_admin) {
          return errorResponse('You can only delete your own posts', 403);
        }
      }

      // Soft delete via Sequelize paranoid
      await post.destroy();

      return successResponse({ message: 'Post deleted successfully' });
    } catch (error) {
      return serverError(error, 'Failed to delete post');
    }
  }
);
