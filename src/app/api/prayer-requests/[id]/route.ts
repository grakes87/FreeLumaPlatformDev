import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Post,
  PostMedia,
  PrayerRequest,
  PrayerSupport,
  User,
} from '@/lib/db/models';
import { checkAndFlag } from '@/lib/moderation/profanity';
import { getBlockedUserIds } from '@/lib/utils/blocks';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const PRAYER_BODY_MAX = 5000;

const ANONYMOUS_AUTHOR = {
  id: 0,
  username: 'anonymous',
  display_name: 'Anonymous',
  avatar_url: null,
  avatar_color: '#9CA3AF',
};

const updatePrayerSchema = z.object({
  body: z
    .string()
    .min(1, 'Prayer request body is required')
    .max(PRAYER_BODY_MAX, `Prayer request must be ${PRAYER_BODY_MAX} characters or less`)
    .optional(),
  privacy: z.enum(['public', 'followers', 'private']).optional(),
  is_anonymous: z.boolean().optional(),
  action: z.enum(['mark_answered']).optional(),
  testimony: z.string().max(5000).optional(),
});

/**
 * GET /api/prayer-requests/[id] - Get prayer request detail
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;
      const params = await context.params;
      const prayerRequestId = parseInt(params.id);

      if (isNaN(prayerRequestId)) {
        return errorResponse('Invalid prayer request ID');
      }

      // Check bible-mode restriction
      const user = await User.findByPk(userId, { attributes: ['id', 'mode'] });
      if (!user) {
        return errorResponse('User not found', 404);
      }
      if (user.mode === 'positivity') {
        return errorResponse('Prayer wall is available in Bible mode', 403);
      }

      const prayerRequest = await PrayerRequest.findByPk(prayerRequestId, {
        include: [
          {
            model: Post,
            as: 'post',
            where: { deleted_at: null },
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
              },
            ],
          },
        ],
      });

      if (!prayerRequest) {
        return errorResponse('Prayer request not found', 404);
      }

      const plain = prayerRequest.toJSON() as unknown as Record<string, unknown>;
      const post = plain.post as Record<string, unknown>;

      if (!post) {
        return errorResponse('Prayer request not found', 404);
      }

      const authorId = post.user_id as number;

      // Block check
      const blockedIds = await getBlockedUserIds(userId);
      if (blockedIds.has(authorId)) {
        return errorResponse('Prayer request not found', 404);
      }

      // Privacy check
      const privacy = plain.privacy as string;
      if (privacy === 'private' && authorId !== userId) {
        return errorResponse('Prayer request not found', 404);
      }
      // For followers privacy, the feed already handles this.
      // For detail view, we allow access if the user navigated here.

      // Check if requesting user has prayed
      const support = await PrayerSupport.findOne({
        where: {
          user_id: userId,
          prayer_request_id: prayerRequestId,
        },
        attributes: ['id'],
      });

      const response: Record<string, unknown> = {
        ...plain,
        post: {
          id: post.id,
          body: post.body,
          user_id: post.user_id,
          is_anonymous: post.is_anonymous,
          edited: post.edited,
          flagged: post.flagged,
          created_at: post.created_at,
          updated_at: post.updated_at,
          user: post.user,
          media: post.media,
        },
        is_praying: !!support,
      };

      // Anonymous handling
      const isAnonymous = post.is_anonymous as boolean;
      if (isAnonymous && authorId !== userId) {
        const postData = response.post as Record<string, unknown>;
        response.post = {
          ...postData,
          user: ANONYMOUS_AUTHOR,
        };
      }

      return successResponse(response);
    } catch (error) {
      return serverError(error, 'Failed to fetch prayer request');
    }
  }
);

/**
 * PUT /api/prayer-requests/[id] - Update prayer request or mark answered
 */
export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;
      const params = await context.params;
      const prayerRequestId = parseInt(params.id);

      if (isNaN(prayerRequestId)) {
        return errorResponse('Invalid prayer request ID');
      }

      const prayerRequest = await PrayerRequest.findByPk(prayerRequestId, {
        include: [
          {
            model: Post,
            as: 'post',
            where: { deleted_at: null },
          },
        ],
      });

      if (!prayerRequest) {
        return errorResponse('Prayer request not found', 404);
      }

      const post = (prayerRequest as unknown as Record<string, unknown>).post as Post;
      if (!post) {
        return errorResponse('Prayer request not found', 404);
      }

      // Verify ownership
      if (post.user_id !== userId) {
        return errorResponse('You can only update your own prayer requests', 403);
      }

      const json = await req.json();
      const parsed = updatePrayerSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { body, privacy, is_anonymous, action, testimony } = parsed.data;

      // Handle mark_answered action
      if (action === 'mark_answered') {
        prayerRequest.status = 'answered';
        prayerRequest.answered_at = new Date();
        if (testimony) {
          prayerRequest.answered_testimony = testimony;
        }
        await prayerRequest.save();
      }

      // Update privacy if provided
      if (privacy !== undefined) {
        prayerRequest.privacy = privacy;
        await prayerRequest.save();
      }

      // Update post body if provided
      if (body !== undefined) {
        const profanityResult = checkAndFlag(body);
        post.body = body;
        post.flagged = profanityResult.flagged;
        post.edited = true;
        await post.save();
      }

      // Update is_anonymous if provided
      if (is_anonymous !== undefined) {
        post.is_anonymous = is_anonymous;
        await post.save();
      }

      // Reload with associations
      const updated = await PrayerRequest.findByPk(prayerRequestId, {
        include: [
          {
            model: Post,
            as: 'post',
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
              },
            ],
          },
        ],
      });

      const plain = updated!.toJSON() as unknown as Record<string, unknown>;
      const updatedPost = plain.post as Record<string, unknown>;

      return successResponse({
        ...plain,
        post: {
          id: updatedPost.id,
          body: updatedPost.body,
          user_id: updatedPost.user_id,
          is_anonymous: updatedPost.is_anonymous,
          edited: updatedPost.edited,
          flagged: updatedPost.flagged,
          created_at: updatedPost.created_at,
          updated_at: updatedPost.updated_at,
          user: updatedPost.user,
          media: updatedPost.media,
        },
      });
    } catch (error) {
      return serverError(error, 'Failed to update prayer request');
    }
  }
);

/**
 * DELETE /api/prayer-requests/[id] - Soft delete prayer request
 */
export const DELETE = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;
      const params = await context.params;
      const prayerRequestId = parseInt(params.id);

      if (isNaN(prayerRequestId)) {
        return errorResponse('Invalid prayer request ID');
      }

      const prayerRequest = await PrayerRequest.findByPk(prayerRequestId, {
        include: [
          {
            model: Post,
            as: 'post',
            where: { deleted_at: null },
          },
        ],
      });

      if (!prayerRequest) {
        return errorResponse('Prayer request not found', 404);
      }

      const post = (prayerRequest as unknown as Record<string, unknown>).post as Post;
      if (!post) {
        return errorResponse('Prayer request not found', 404);
      }

      // Verify ownership or admin
      if (post.user_id !== userId) {
        // Check if admin
        const dbUser = await User.findByPk(userId, { attributes: ['id', 'is_admin'] });
        if (!dbUser?.is_admin) {
          return errorResponse('You can only delete your own prayer requests', 403);
        }
      }

      // Soft delete (paranoid)
      await post.destroy();

      return successResponse({ success: true });
    } catch (error) {
      return serverError(error, 'Failed to delete prayer request');
    }
  }
);
