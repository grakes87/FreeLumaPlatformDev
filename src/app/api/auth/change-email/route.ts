import { NextRequest } from 'next/server';
import { z } from 'zod';
import { SignJWT } from 'jose';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User } from '@/lib/db/models';
import { sendEmailChangeVerification } from '@/lib/email';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { rateLimit } from '@/lib/utils/rate-limit';

const changeEmailSchema = z.object({
  new_email: z.string().email('Invalid email address'),
});

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(jwtSecret);
}

export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      // Rate limit: 3 per hour per user
      const rl = rateLimit(
        `change-email:${context.user.id}`,
        3,
        60 * 60 * 1000
      );
      if (!rl.success) {
        return errorResponse(
          'Too many email change requests. Please try again later.',
          429
        );
      }

      const body = await req.json();
      const parsed = changeEmailSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const newEmail = parsed.data.new_email.toLowerCase().trim();

      // Check not same as current email
      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'email'],
      });

      if (!user) {
        return errorResponse('User not found', 404);
      }

      if (user.email === newEmail) {
        return errorResponse('New email is the same as your current email', 400);
      }

      // Check new email not taken
      const existing = await User.findOne({
        where: { email: newEmail },
        attributes: ['id'],
      });

      if (existing) {
        return errorResponse('This email address is already in use', 409);
      }

      // Generate purpose-scoped JWT with 24h expiry
      const token = await new SignJWT({
        id: user.id,
        old_email: user.email,
        new_email: newEmail,
        purpose: 'email_change',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getSecret());

      // Send verification email to NEW email address
      await sendEmailChangeVerification(newEmail, token);

      return successResponse({
        message: 'Verification email sent to your new address. Please check your inbox.',
      });
    } catch (error) {
      return serverError(error, 'Failed to initiate email change');
    }
  }
);
