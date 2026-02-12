import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User, UserSetting } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

export const GET = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const user = await User.findByPk(context.user.id, {
        attributes: {
          exclude: ['password_hash', 'email_verification_token'],
        },
        include: [
          {
            model: UserSetting,
            as: 'settings',
          },
        ],
      });

      if (!user) {
        return errorResponse('User not found', 404);
      }

      return successResponse({ user });
    } catch (error) {
      return serverError(error, 'Failed to get user data');
    }
  }
);
