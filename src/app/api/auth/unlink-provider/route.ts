import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const unlinkProviderSchema = z.object({
  provider: z.enum(['google', 'apple']),
});

export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const body = await req.json();
      const parsed = unlinkProviderSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { provider } = parsed.data;

      // Fetch user with all auth-related fields
      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'password_hash', 'google_id', 'apple_id'],
      });

      if (!user) {
        return errorResponse('User not found', 404);
      }

      const providerIdColumn = provider === 'google' ? 'google_id' : 'apple_id';
      const currentProviderId = provider === 'google' ? user.google_id : user.apple_id;

      // Check the provider is actually linked
      if (!currentProviderId) {
        return errorResponse(
          `${provider === 'google' ? 'Google' : 'Apple'} is not linked to your account`,
          400
        );
      }

      // Check user has a password set
      if (!user.password_hash) {
        return errorResponse(
          'Cannot unlink: you need a password to sign in. Set a password first via the forgot password flow.',
          400
        );
      }

      // Check unlinking won't leave no auth method
      // User has password (checked above), so they can still sign in.
      // But also check if this is the ONLY provider and they have no password
      // (already covered above, but double-check for safety)
      const otherProvider = provider === 'google' ? user.apple_id : user.google_id;
      if (!user.password_hash && !otherProvider) {
        return errorResponse(
          'Cannot unlink: no other sign-in method available',
          400
        );
      }

      // Unlink the provider
      await user.update({ [providerIdColumn]: null });

      return successResponse({
        message: 'Provider unlinked successfully',
        provider,
      });
    } catch (error) {
      return serverError(error, 'Failed to unlink provider');
    }
  }
);
