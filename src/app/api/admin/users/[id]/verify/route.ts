import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * PATCH /api/admin/users/[id]/verify — Toggle is_verified on a user
 */
export const PATCH = withAdmin(async (_req: NextRequest, context: AuthContext) => {
  try {
    const { User } = await import('@/lib/db/models');
    const params = await context.params;
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return errorResponse('Invalid user ID', 400);
    }

    const user = await User.findByPk(id, {
      attributes: ['id', 'is_verified'],
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    user.is_verified = !user.is_verified;
    await user.save();

    return successResponse({
      id: user.id,
      is_verified: user.is_verified,
    });
  } catch (error) {
    return serverError(error, 'Failed to toggle verification');
  }
});
