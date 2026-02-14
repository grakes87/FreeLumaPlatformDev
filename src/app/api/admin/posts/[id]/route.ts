import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * PUT /api/admin/posts/[id] - Toggle hidden status on a post
 *
 * Body: { hidden: boolean }
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Post } = await import('@/lib/db/models');
    const params = await context.params;
    const postId = parseInt(params.id, 10);
    if (isNaN(postId)) {
      return errorResponse('Invalid post ID');
    }

    const body = await req.json();
    if (typeof body.hidden !== 'boolean') {
      return errorResponse('hidden must be a boolean');
    }

    const post = await Post.findByPk(postId, { paranoid: false });
    if (!post) {
      return errorResponse('Post not found', 404);
    }

    await post.update({ hidden: body.hidden });

    return successResponse({
      id: post.id,
      hidden: post.hidden,
      message: body.hidden ? 'Post hidden' : 'Post unhidden',
    });
  } catch (error) {
    return serverError(error, 'Failed to update post');
  }
});
