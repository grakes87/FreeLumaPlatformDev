import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { User } from '@/lib/db/models';
import { sendEmail } from '@/lib/email';
import { emailChangeAlertTemplate } from '@/lib/email/templates';

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
      `${APP_URL}/settings?error=invalid_email_change_link`
    );
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const data = payload as {
      id?: number;
      old_email?: string;
      new_email?: string;
      purpose?: string;
    };

    if (
      data.purpose !== 'email_change' ||
      !data.id ||
      !data.old_email ||
      !data.new_email
    ) {
      return NextResponse.redirect(
        `${APP_URL}/settings?error=invalid_email_change_link`
      );
    }

    // Find user and verify current email matches old_email (race condition guard)
    const user = await User.findByPk(data.id, {
      attributes: ['id', 'email', 'email_verified'],
    });

    if (!user || user.email !== data.old_email) {
      return NextResponse.redirect(
        `${APP_URL}/settings?error=invalid_email_change_link`
      );
    }

    // Check new email not taken (could have been claimed since token was issued)
    const existing = await User.findOne({
      where: { email: data.new_email },
      attributes: ['id'],
    });

    if (existing) {
      return NextResponse.redirect(
        `${APP_URL}/settings?error=email_already_taken`
      );
    }

    // Update email
    await user.update({
      email: data.new_email,
      email_verified: true,
    });

    // Send security alert to OLD email
    try {
      const alertHtml = emailChangeAlertTemplate(data.old_email, data.new_email);
      await sendEmail(
        data.old_email,
        'Your email address was changed - Free Luma',
        alertHtml
      );
    } catch (emailError) {
      // Non-fatal: log but don't block the email change
      console.error('[Email Change] Failed to send security alert:', emailError);
    }

    return NextResponse.redirect(
      `${APP_URL}/settings?email_changed=true`
    );
  } catch {
    return NextResponse.redirect(
      `${APP_URL}/settings?error=expired_email_change_link`
    );
  }
}
