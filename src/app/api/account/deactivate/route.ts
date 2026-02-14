import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User } from '@/lib/db/models';
import { clearAuthCookie } from '@/lib/auth/jwt';
import { serverError } from '@/lib/utils/api';

export const POST = withAuth(async (_req: NextRequest, context: AuthContext) => {
  try {
    const user = await User.findByPk(context.user.id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Set status to deactivated
    await user.update({
      status: 'deactivated',
      deactivated_at: new Date(),
    });

    // Clear auth cookie (log user out)
    const response = NextResponse.json(
      { message: 'Account deactivated. Log in again to reactivate.' },
      { status: 200 }
    );
    response.headers.set('Set-Cookie', clearAuthCookie());
    return response;
  } catch (error) {
    return serverError(error, 'Failed to deactivate account');
  }
});
