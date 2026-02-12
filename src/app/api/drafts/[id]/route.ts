import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { Draft } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * DELETE /api/drafts/[id] - Discard a draft (owner only)
 */
export const DELETE = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const draftId = parseInt(params.id, 10);

      if (isNaN(draftId)) {
        return errorResponse('Invalid draft ID');
      }

      const draft = await Draft.findByPk(draftId);

      if (!draft) {
        return errorResponse('Draft not found', 404);
      }

      // Verify ownership
      if (draft.user_id !== context.user.id) {
        return errorResponse('Forbidden', 403);
      }

      await draft.destroy();

      return successResponse({ success: true });
    } catch (err) {
      return serverError(err, 'Failed to delete draft');
    }
  }
);
