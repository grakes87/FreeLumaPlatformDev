import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * POST /api/posts/[id]/impression
 *
 * Records a view impression for a post. Uses INSERT IGNORE to deduplicate —
 * each user can only contribute one impression per post (unique constraint).
 * The post author's own view counts as at most 1 impression (same rule).
 */
export const POST = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const postId = parseInt(params.id, 10);

    if (!postId || isNaN(postId)) {
      return successResponse({ recorded: false });
    }

    const { PostImpression } = await import('@/lib/db/models');

    // INSERT IGNORE — silently skip if unique constraint (post_id, user_id) exists
    await PostImpression.findOrCreate({
      where: { post_id: postId, user_id: context.user.id },
      defaults: { post_id: postId, user_id: context.user.id },
    });

    return successResponse({ recorded: true });
  } catch (error) {
    return serverError(error, 'Failed to record impression');
  }
});
