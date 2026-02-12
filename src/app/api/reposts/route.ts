import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Post,
  PostMedia,
  Repost,
  User,
  Block,
} from '@/lib/db/models';
import { checkAndFlag } from '@/lib/moderation/profanity';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';

const REPOST_BODY_MAX = 5000;

const createRepostSchema = z.object({
  original_post_id: z.number().int().positive(),
  body: z.string().min(1, 'Quote body is required').max(REPOST_BODY_MAX, `Quote body must be ${REPOST_BODY_MAX} characters or less`),
});

/**
 * POST /api/reposts — Create a quote repost
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const json = await req.json();
      const parsed = createRepostSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { original_post_id, body } = parsed.data;
      const userId = context.user.id;

      // Validate original post exists and is not deleted
      const originalPost = await Post.findByPk(original_post_id, {
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
      });

      if (!originalPost) {
        return errorResponse('Original post not found', 404);
      }

      // Check if the original post author has blocked the user or vice versa
      const blockExists = await Block.findOne({
        where: {
          [Op.or]: [
            { blocker_id: userId, blocked_id: originalPost.user_id },
            { blocker_id: originalPost.user_id, blocked_id: userId },
          ],
        },
      });

      if (blockExists) {
        return errorResponse('Cannot repost this content', 403);
      }

      // Get user's mode for the new quote post
      const user = await User.findByPk(userId, { attributes: ['id', 'mode'] });
      if (!user) {
        return errorResponse('User not found', 404);
      }

      // Run profanity check on body (flag, don't block)
      const { flagged, censored } = checkAndFlag(body);

      // Create the new quote post
      const quotePost = await Post.create({
        user_id: userId,
        body: censored,
        post_type: 'text',
        mode: user.mode,
        flagged,
      });

      // Create the repost record
      await Repost.create({
        user_id: userId,
        post_id: original_post_id,
        quote_post_id: quotePost.id,
      });

      // Re-fetch the created quote post with user info
      const created = await Post.findByPk(quotePost.id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
          },
        ],
      });

      return successResponse({
        post: created,
        original_post: originalPost,
        flagged,
      }, 201);
    } catch (error) {
      return serverError(error, 'Failed to create repost');
    }
  }
);
