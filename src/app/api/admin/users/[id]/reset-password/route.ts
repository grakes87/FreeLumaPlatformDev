import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { sendPasswordResetEmail } from '@/lib/email';

function getResetSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(jwtSecret);
}

/**
 * POST /api/admin/users/[id]/reset-password - Send password reset email to user
 */
export const POST = withAdmin(async (_req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) {
      return errorResponse('Invalid user ID');
    }

    const adminId = context.user.id;
    const { User, ModerationLog } = await import('@/lib/db/models');

    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'username'],
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

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

    await ModerationLog.create({
      admin_id: adminId,
      action: 'send_reset_email',
      target_user_id: userId,
      reason: `Password reset email sent to ${user.email}`,
    });

    return successResponse({ message: `Password reset email sent to ${user.email}` });
  } catch (error) {
    return serverError(error, 'Failed to send password reset email');
  }
});
