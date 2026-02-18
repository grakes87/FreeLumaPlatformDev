import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { normalizePhone, isUSOrCanada } from '@/lib/utils/phone';
import { sendOTP, checkOTP } from '@/lib/sms/verify';

// --- POST: Send OTP ---

const sendSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
});

export const POST = withAuth(async (req: NextRequest, context: AuthContext) => {
  const body = await req.json();
  const parsed = sendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const normalized = normalizePhone(parsed.data.phone);
  if (!normalized) {
    return NextResponse.json(
      { error: 'Invalid phone number' },
      { status: 400 }
    );
  }

  // US/Canada only
  if (!isUSOrCanada(normalized)) {
    return NextResponse.json(
      { error: 'SMS notifications are currently available for US and Canada only' },
      { status: 400 }
    );
  }

  // Send OTP via Twilio Verify
  const result = await sendOTP(normalized);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Failed to send verification code' },
      { status: 400 }
    );
  }

  // Save phone to user (unverified)
  const { User } = await import('@/lib/db/models');
  await User.update(
    { phone: normalized, phone_verified: false },
    { where: { id: context.user.id } }
  );

  return NextResponse.json({ success: true });
});

// --- PUT: Verify OTP ---

const verifySchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const PUT = withAuth(async (req: NextRequest, context: AuthContext) => {
  const body = await req.json();
  const parsed = verifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const normalized = normalizePhone(parsed.data.phone);
  if (!normalized) {
    return NextResponse.json(
      { error: 'Invalid phone number' },
      { status: 400 }
    );
  }

  // Verify the phone matches the user's stored phone
  const { User, UserSetting } = await import('@/lib/db/models');
  const user = await User.findByPk(context.user.id, {
    attributes: ['id', 'phone'],
  });

  if (!user || user.phone !== normalized) {
    return NextResponse.json(
      { error: 'Phone number mismatch' },
      { status: 400 }
    );
  }

  // Check OTP via Twilio Verify
  const result = await checkOTP(normalized, parsed.data.code);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Invalid verification code' },
      { status: 400 }
    );
  }

  // Mark phone as verified
  await User.update(
    { phone_verified: true },
    { where: { id: context.user.id } }
  );

  // Auto-enable SMS notifications on verification
  await UserSetting.update(
    { sms_notifications_enabled: true },
    { where: { user_id: context.user.id } }
  );

  return NextResponse.json({ success: true, phone_verified: true });
});
