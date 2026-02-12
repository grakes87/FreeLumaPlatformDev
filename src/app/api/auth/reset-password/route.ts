import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jwtVerify } from 'jose';
import { hashPassword } from '@/lib/auth/password';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

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
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { token, password } = parsed.data;

    // Verify the reset JWT
    let payload: { id?: number; email?: string; purpose?: string };
    try {
      const result = await jwtVerify(token, getResetSecret());
      payload = result.payload as typeof payload;
    } catch {
      return errorResponse('Invalid or expired reset link. Please request a new one.', 400);
    }

    // Validate the token purpose
    if (payload.purpose !== 'password_reset' || !payload.id || !payload.email) {
      return errorResponse('Invalid reset token.', 400);
    }

    // Lazy-import models
    const { User } = await import('@/lib/db/models');

    const user = await User.findByPk(payload.id, {
      attributes: ['id', 'email'],
    });

    if (!user || user.email !== payload.email) {
      return errorResponse('Invalid reset token.', 400);
    }

    // Hash new password and update
    const passwordHash = await hashPassword(password);

    await user.update({
      password_hash: passwordHash,
      failed_login_attempts: 0,
      locked_until: null,
    });

    return successResponse({ message: 'Password reset successfully.' });
  } catch (error) {
    return serverError(error, 'Failed to reset password');
  }
}
