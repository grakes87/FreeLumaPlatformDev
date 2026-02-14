import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * PUT /api/admin/comments/[id] - Toggle hidden status on a comment
 *
 * Body: { hidden: boolean }
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { PostComment } = await import('@/lib/db/models');
    const params = await context.params;
    const commentId = parseInt(params.id, 10);
    if (isNaN(commentId)) {
      return errorResponse('Invalid comment ID');
    }

    const body = await req.json();
    if (typeof body.hidden !== 'boolean') {
      return errorResponse('hidden must be a boolean');
    }

    const comment = await PostComment.findByPk(commentId);
    if (!comment) {
      return errorResponse('Comment not found', 404);
    }

    await comment.update({ hidden: body.hidden });

    return successResponse({
      id: comment.id,
      hidden: comment.hidden,
      message: body.hidden ? 'Comment hidden' : 'Comment unhidden',
    });
  } catch (error) {
    return serverError(error, 'Failed to update comment');
  }
});
