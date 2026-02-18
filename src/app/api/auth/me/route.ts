import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User, UserSetting, LumaShortCreator } from '@/lib/db/models';
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

      // Check if user is an active creator
      const creatorProfile = await LumaShortCreator.findOne({
        where: { user_id: user.id, active: true },
        attributes: ['id'],
      });

      const userData = { ...user.toJSON(), is_creator: !!creatorProfile };

      return successResponse({ user: userData, token: context.token });
    } catch (error) {
      return serverError(error, 'Failed to get user data');
    }
  }
);
