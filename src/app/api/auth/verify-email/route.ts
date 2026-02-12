import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { User } from '@/lib/db/models';

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(jwtSecret);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(
      `${APP_URL}/login?error=invalid_verification_link`
    );
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const data = payload as { id?: number; email?: string; purpose?: string };

    if (
      data.purpose !== 'email_verification' ||
      !data.id ||
      !data.email
    ) {
      return NextResponse.redirect(
        `${APP_URL}/login?error=invalid_verification_link`
      );
    }

    const user = await User.findByPk(data.id, {
      attributes: ['id', 'email', 'email_verified'],
    });

    if (!user || user.email !== data.email) {
      return NextResponse.redirect(
        `${APP_URL}/login?error=invalid_verification_link`
      );
    }

    if (!user.email_verified) {
      await user.update({ email_verified: true });
    }

    // Redirect to the app with success indicator
    return NextResponse.redirect(
      `${APP_URL}/profile?email_verified=true`
    );
  } catch {
    return NextResponse.redirect(
      `${APP_URL}/login?error=expired_verification_link`
    );
  }
}
