import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { DailyComment } from '@/lib/db/models';
import { COMMENT_MAX_LENGTH } from '@/lib/utils/constants';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const updateCommentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty').max(COMMENT_MAX_LENGTH, `Comment must be ${COMMENT_MAX_LENGTH} characters or less`),
});

export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return errorResponse('Invalid comment id');

      const comment = await DailyComment.findByPk(id);
      if (!comment) return errorResponse('Comment not found', 404);

      if (comment.user_id !== context.user.id) {
        return errorResponse('Forbidden', 403);
      }

      const body = await req.json();
      const parsed = updateCommentSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      await comment.update({ body: parsed.data.body, edited: true });

      return successResponse({ id: comment.id, body: comment.body, edited: comment.edited });
    } catch (error) {
      return serverError(error, 'Failed to update comment');
    }
  }
);

export const DELETE = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return errorResponse('Invalid comment id');

      const comment = await DailyComment.findByPk(id);
      if (!comment) return errorResponse('Comment not found', 404);

      if (comment.user_id !== context.user.id) {
        return errorResponse('Forbidden', 403);
      }

      await comment.destroy();

      return successResponse({ deleted: true });
    } catch (error) {
      return serverError(error, 'Failed to delete comment');
    }
  }
);
