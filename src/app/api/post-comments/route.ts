import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op, literal } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { PostComment, Post, User, Follow } from '@/lib/db/models';
import { POST_COMMENT_MAX_LENGTH } from '@/lib/utils/constants';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { checkAndFlag } from '@/lib/moderation/profanity';
import { getBlockedUserIds } from '@/lib/utils/blocks';

const createCommentSchema = z.object({
  post_id: z.number().int().positive(),
  parent_id: z.number().int().positive().nullable().optional(),
  body: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(POST_COMMENT_MAX_LENGTH, `Comment must be ${POST_COMMENT_MAX_LENGTH} characters or less`),
});

const USER_ATTRIBUTES = ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'] as const;

/**
 * GET /api/post-comments
 * Fetch comments for a post with cursor pagination, block exclusion, and nested reply previews.
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const postId = parseInt(searchParams.get('post_id') || '', 10);

      if (!postId || isNaN(postId)) {
        return errorResponse('post_id is required');
      }

      const parentIdParam = searchParams.get('parent_id');
      const parentId =
        parentIdParam === null || parentIdParam === 'null'
          ? null
          : parseInt(parentIdParam, 10);

      const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
      const cursor = searchParams.get('cursor');

      // Get blocked user IDs
      const blockedIds = await getBlockedUserIds(context.user.id);
      const blockedArray = [...blockedIds];

      // Build where clause
      const where: Record<string, unknown> = {
        post_id: postId,
        parent_id: parentId,
      };

      if (blockedArray.length > 0) {
        where.user_id = { [Op.notIn]: blockedArray };
      }

      if (cursor) {
        where.id = { [Op.gt]: parseInt(cursor, 10) };
      }

      const comments = await PostComment.findAll({
        where,
        include: [
          {
            model: User,
            as: 'user',
            attributes: [...USER_ATTRIBUTES],
          },
        ],
        attributes: {
          include: [
            [
              literal(
                `(SELECT COUNT(*) FROM post_comments AS r WHERE r.parent_id = \`PostComment\`.\`id\`)`
              ),
              'reply_count',
            ],
          ],
        },
        order: [['created_at', 'ASC']],
        limit: limit + 1, // fetch one extra to determine has_more
      });

      const hasMore = comments.length > limit;
      const results = hasMore ? comments.slice(0, limit) : comments;

      // Get top 2 replies per root comment (only for root comments)
      const rootIds = parentId === null ? results.map((c) => c.id) : [];
      let repliesMap: Record<number, unknown[]> = {};

      if (rootIds.length > 0) {
        const replyWhere: Record<string, unknown> = {
          parent_id: { [Op.in]: rootIds },
        };
        if (blockedArray.length > 0) {
          replyWhere.user_id = { [Op.notIn]: blockedArray };
        }

        const allReplies = await PostComment.findAll({
          where: replyWhere,
          include: [
            {
              model: User,
              as: 'user',
              attributes: [...USER_ATTRIBUTES],
            },
          ],
          order: [['created_at', 'ASC']],
        });

        // Group and take top 2 per parent
        for (const reply of allReplies) {
          const pid = reply.parent_id!;
          if (!repliesMap[pid]) repliesMap[pid] = [];
          if (repliesMap[pid].length < 2) {
            repliesMap[pid].push(reply.toJSON());
          }
        }
      }

      const formatted = results.map((c) => {
        const plain = c.toJSON() as unknown as Record<string, unknown>;
        return {
          ...plain,
          reply_count: parseInt(String(plain.reply_count || '0'), 10),
          replies: repliesMap[c.id] || [],
        };
      });

      const nextCursor = results.length > 0 ? String(results[results.length - 1].id) : null;

      return successResponse({
        comments: formatted,
        has_more: hasMore,
        next_cursor: nextCursor,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch comments');
    }
  }
);

/**
 * POST /api/post-comments
 * Create a new comment on a post. Supports threaded replies (max 2 levels).
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const body = await req.json();
      const parsed = createCommentSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { post_id, parent_id, body: commentBody } = parsed.data;
      const userId = context.user.id;

      // Verify post exists and check visibility
      const post = await Post.findByPk(post_id, { attributes: ['id', 'user_id', 'visibility'] });
      if (!post) {
        return errorResponse('Post not found', 404);
      }

      // Enforce followers-only visibility
      if (post.visibility === 'followers' && post.user_id !== userId) {
        const isFollowing = await Follow.findOne({
          where: { follower_id: userId, following_id: post.user_id, status: 'active' },
          attributes: ['id'],
        });
        if (!isFollowing) {
          return errorResponse('Post not found', 404);
        }
      }

      // Resolve parent for 2-level threading
      let resolvedParentId: number | null = parent_id ?? null;

      if (resolvedParentId) {
        const parentComment = await PostComment.findOne({
          where: { id: resolvedParentId, post_id },
        });
        if (!parentComment) {
          return errorResponse('Parent comment not found', 404);
        }

        // If the parent itself has a parent, flatten to root (enforce 2-level depth)
        if (parentComment.parent_id !== null) {
          resolvedParentId = parentComment.parent_id;
        }
      }

      // Profanity check
      const { flagged } = checkAndFlag(commentBody);

      const comment = await PostComment.create({
        user_id: userId,
        post_id,
        parent_id: resolvedParentId,
        body: commentBody,
        flagged,
      });

      // Fire-and-forget: track social activity
      import('@/lib/streaks/tracker').then(({ trackActivity }) => {
        trackActivity(userId, 'social_activity').catch(() => {});
      }).catch(() => {});

      // Re-fetch with user data
      const full = await PostComment.findByPk(comment.id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: [...USER_ATTRIBUTES],
          },
        ],
      });

      // Create notification for post owner (not for comments on own posts)
      try {
        if (post.user_id !== userId) {
          const { createNotification } = await import('@/lib/notifications/create');
          const { NotificationType, NotificationEntityType } = await import('@/lib/notifications/types');
          const previewBody = commentBody.length > 80 ? commentBody.slice(0, 80) + '...' : commentBody;
          await createNotification({
            recipient_id: post.user_id,
            actor_id: userId,
            type: NotificationType.COMMENT,
            entity_type: NotificationEntityType.POST,
            entity_id: post_id,
            preview_text: `commented: "${previewBody}"`,
          });
        }
      } catch {
        // Non-fatal
      }

      return successResponse(
        { ...full!.toJSON(), reply_count: 0, replies: [] },
        201
      );
    } catch (error) {
      return serverError(error, 'Failed to create comment');
    }
  }
);
