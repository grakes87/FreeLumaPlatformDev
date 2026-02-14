import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * POST /api/account/reactivate — Explicitly reactivate a deactivated account
 */
export const POST = withAuth(async (_req: NextRequest, context: AuthContext) => {
  try {
    const user = await User.findByPk(context.user.id);

    if (!user) {
      return errorResponse('User not found', 404);
    }

    if (user.status !== 'deactivated') {
      return errorResponse('Account is not deactivated', 400);
    }

    await user.update({
      status: 'active',
      deactivated_at: null,
    });

    return successResponse({ message: 'Account reactivated successfully' });
  } catch (error) {
    return serverError(error, 'Failed to reactivate account');
  }
});
