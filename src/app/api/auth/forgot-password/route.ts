import { NextRequest } from 'next/server';
import { z } from 'zod';
import { SignJWT } from 'jose';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { rateLimit } from '@/lib/utils/rate-limit';
import { sendPasswordResetEmail } from '@/lib/email';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Generic message to avoid revealing whether email exists
const GENERIC_MESSAGE =
  'If an account exists with that email, a reset link has been sent.';

function getResetSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(jwtSecret);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Rate limit: 3 per hour per email
    const rl = rateLimit(`forgot-password:${normalizedEmail}`, 3, 60 * 60 * 1000);
    if (!rl.success) {
      return errorResponse(
        'Too many password reset requests. Please try again later.',
        429
      );
    }

    // Lazy-import User model to avoid module initialization issues
    const { User } = await import('@/lib/db/models');

    const user = await User.findOne({
      where: { email: normalizedEmail },
      attributes: ['id', 'email'],
    });

    if (user) {
      // Generate a signed JWT with 1-hour expiry for password reset
      const resetToken = await new SignJWT({
        id: user.id,
        email: user.email,
        purpose: 'password_reset',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(getResetSecret());

      await sendPasswordResetEmail(user.email, resetToken);
    }

    // Always return 200 to avoid revealing whether email exists
    return successResponse({ message: GENERIC_MESSAGE });
  } catch (error) {
    return serverError(error, 'Failed to process password reset request');
  }
}
