import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User } from '@/lib/db/models';
import { sendVerificationEmail } from '@/lib/email';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { rateLimit } from '@/lib/utils/rate-limit';

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(jwtSecret);
}

export const POST = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      // Rate limit: 3 per hour per user
      const rl = rateLimit(
        `send-verification:${context.user.id}`,
        3,
        60 * 60 * 1000
      );
      if (!rl.success) {
        return errorResponse(
          'Too many verification requests. Please try again later.',
          429
        );
      }

      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'email', 'email_verified'],
      });

      if (!user) {
        return errorResponse('User not found', 404);
      }

      if (user.email_verified) {
        return successResponse({ message: 'Email is already verified.' });
      }

      // Generate verification JWT with 24-hour expiry
      const verificationToken = await new SignJWT({
        id: user.id,
        email: user.email,
        purpose: 'email_verification',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getSecret());

      await sendVerificationEmail(user.email, verificationToken);

      return successResponse({ message: 'Verification email sent.' });
    } catch (error) {
      return serverError(error, 'Failed to send verification email');
    }
  }
);
