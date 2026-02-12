import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { PostComment, User } from '@/lib/db/models';
import { POST_COMMENT_MAX_LENGTH } from '@/lib/utils/constants';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { checkAndFlag } from '@/lib/moderation/profanity';

const updateCommentSchema = z.object({
  body: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(POST_COMMENT_MAX_LENGTH, `Comment must be ${POST_COMMENT_MAX_LENGTH} characters or less`),
});

/**
 * PUT /api/post-comments/[id]
 * Edit a comment. Owner only, no time limit. Re-runs profanity filter, sets edited=true.
 */
export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return errorResponse('Invalid comment id');

      const comment = await PostComment.findByPk(id);
      if (!comment) return errorResponse('Comment not found', 404);

      if (comment.user_id !== context.user.id) {
        return errorResponse('Forbidden', 403);
      }

      const body = await req.json();
      const parsed = updateCommentSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      // Re-run profanity check on edited text
      const { flagged } = checkAndFlag(parsed.data.body);

      await comment.update({
        body: parsed.data.body,
        edited: true,
        flagged,
      });

      return successResponse({
        id: comment.id,
        body: comment.body,
        edited: comment.edited,
        flagged: comment.flagged,
      });
    } catch (error) {
      return serverError(error, 'Failed to update comment');
    }
  }
);

/**
 * DELETE /api/post-comments/[id]
 * Delete a comment. Owner or admin. Hard delete + cascade replies.
 */
export const DELETE = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return errorResponse('Invalid comment id');

      const comment = await PostComment.findByPk(id);
      if (!comment) return errorResponse('Comment not found', 404);

      // Check ownership or admin
      if (comment.user_id !== context.user.id) {
        // Check admin
        const { User: UserModel } = await import('@/lib/db/models');
        const dbUser = await UserModel.findByPk(context.user.id, {
          attributes: ['id', 'is_admin'],
        });
        if (!dbUser?.is_admin) {
          return errorResponse('Forbidden', 403);
        }
      }

      // Hard delete all replies first (cascade)
      await PostComment.destroy({
        where: { parent_id: id },
      });

      // Then delete the comment itself
      await comment.destroy();

      return successResponse({ deleted: true });
    } catch (error) {
      return serverError(error, 'Failed to delete comment');
    }
  }
);
