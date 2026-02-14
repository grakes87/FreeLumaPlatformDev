import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User } from '@/lib/db/models';
import { comparePassword } from '@/lib/auth/password';
import { clearAuthCookie } from '@/lib/auth/jwt';
import { sendAccountDeletionEmail } from '@/lib/email';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const GRACE_PERIOD_DAYS = 30;

const deleteSchema = z.object({
  password: z.string().optional(),
});

export const POST = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return errorResponse(firstError?.message || 'Invalid input', 400);
    }

    const { password } = parsed.data;

    const user = await User.findByPk(context.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Require password confirmation if user has a password set (not OAuth-only)
    if (user.password_hash) {
      if (!password) {
        return errorResponse('Password required to confirm account deletion', 400);
      }
      const passwordMatch = await comparePassword(password, user.password_hash);
      if (!passwordMatch) {
        return errorResponse('Incorrect password', 401);
      }
    }

    const now = new Date();
    const deletionDate = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Set status to pending_deletion
    await user.update({
      status: 'pending_deletion',
      deletion_requested_at: now,
    });

    // Send email notification about the 30-day grace period (non-fatal)
    try {
      await sendAccountDeletionEmail(user.email, user.display_name, deletionDate);
    } catch (err) {
      console.error('[Account Delete] Failed to send deletion email:', err);
    }

    // Clear auth cookie (log user out)
    const response = successResponse({
      message: `Account scheduled for deletion in ${GRACE_PERIOD_DAYS} days. Log in to cancel.`,
      deletion_date: deletionDate.toISOString(),
    });
    response.headers.set('Set-Cookie', clearAuthCookie());
    return response;
  } catch (error) {
    return serverError(error, 'Failed to request account deletion');
  }
});
