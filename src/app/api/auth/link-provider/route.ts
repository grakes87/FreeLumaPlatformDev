import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User } from '@/lib/db/models';
import { verifyGoogleCredential, verifyGoogleAccessToken } from '@/lib/auth/google';
import { verifyAppleToken } from '@/lib/auth/apple';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const linkProviderSchema = z.object({
  provider: z.enum(['google', 'apple']),
  token: z.string().min(1, 'Token is required'),
  token_type: z.enum(['id_token', 'access_token']).optional().default('id_token'),
  // Apple may provide user name on first auth
  user_name: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
});

export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const body = await req.json();
      const parsed = linkProviderSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { provider, token, token_type, user_name } = parsed.data;

      // Verify the OAuth token server-side
      let providerId: string;
      let providerEmail: string | null = null;

      if (provider === 'google') {
        if (!process.env.GOOGLE_CLIENT_ID) {
          return errorResponse('Google Sign-In is not configured', 503);
        }

        try {
          const googleUser = token_type === 'access_token'
            ? await verifyGoogleAccessToken(token)
            : await verifyGoogleCredential(token);
          providerId = googleUser.googleId;
          providerEmail = googleUser.email;
        } catch {
          return errorResponse('Invalid Google credential', 401);
        }
      } else {
        // Apple
        if (!process.env.APPLE_CLIENT_ID) {
          return errorResponse('Apple Sign-In is not configured', 503);
        }

        try {
          const appleUser = await verifyAppleToken(token, user_name);
          providerId = appleUser.appleId;
        } catch {
          return errorResponse('Invalid Apple credential', 401);
        }
      }

      const providerIdColumn = provider === 'google' ? 'google_id' : 'apple_id';

      // Check if this provider ID is already linked to another user
      const existingLink = await User.findOne({
        where: { [providerIdColumn]: providerId },
        attributes: ['id'],
      });

      if (existingLink) {
        if (existingLink.id === context.user.id) {
          return errorResponse(
            `This ${provider === 'google' ? 'Google' : 'Apple'} account is already linked to your account`,
            400
          );
        }
        return errorResponse(
          `This ${provider === 'google' ? 'Google' : 'Apple'} account is already linked to another user`,
          409
        );
      }

      // Check if user already has this provider linked (different account)
      const user = await User.findByPk(context.user.id, {
        attributes: ['id', providerIdColumn],
      });

      if (!user) {
        return errorResponse('User not found', 404);
      }

      const currentProviderId = provider === 'google' ? user.google_id : user.apple_id;
      if (currentProviderId) {
        return errorResponse(
          `A different ${provider === 'google' ? 'Google' : 'Apple'} account is already linked. Unlink it first.`,
          400
        );
      }

      // Link the provider
      const updateData: Record<string, string | null> = { [providerIdColumn]: providerId };
      if (provider === 'google' && providerEmail) {
        updateData.google_email = providerEmail;
      }
      await user.update(updateData);

      return successResponse({
        message: 'Provider linked successfully',
        provider,
        email: providerEmail,
      });
    } catch (error) {
      return serverError(error, 'Failed to link provider');
    }
  }
);
