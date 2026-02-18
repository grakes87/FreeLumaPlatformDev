import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/**
 * POST /api/sms/webhook
 *
 * Twilio inbound webhook handler.
 * Processes STOP/START opt-out messages and syncs to user_settings.
 * No auth middleware — Twilio calls this directly, validated via signature.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse form-encoded body
    const bodyText = await req.text();
    const params = Object.fromEntries(new URLSearchParams(bodyText));

    // Validate Twilio request signature
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (authToken) {
      const signature = req.headers.get('x-twilio-signature') || '';

      // Reconstruct canonical URL for signature validation
      // In production behind a reverse proxy, use forwarded headers
      const proto = req.headers.get('x-forwarded-proto') || 'https';
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
      const pathname = new URL(req.url).pathname;
      const canonicalUrl = `${proto}://${host}${pathname}`;

      const isValid = twilio.validateRequest(authToken, signature, canonicalUrl, params);

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid Twilio signature' },
          { status: 403 }
        );
      }
    } else {
      console.warn('[SMS Webhook] TWILIO_AUTH_TOKEN not set, skipping signature validation (dev mode)');
    }

    const from = params.From; // E.164 phone number
    const optOutType = params.OptOutType; // 'STOP' or 'START'

    if (!from || !optOutType) {
      // Not an opt-out message, return empty TwiML
      return new NextResponse(TWIML_EMPTY, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const { User, UserSetting } = await import('@/lib/db/models');

    if (optOutType === 'STOP') {
      const user = await User.findOne({
        where: { phone: from },
        attributes: ['id'],
      });

      if (user) {
        await UserSetting.update(
          { sms_notifications_enabled: false },
          { where: { user_id: user.id } }
        );
        console.log(`[SMS Webhook] STOP from ${from}, user ${user.id}`);
      } else {
        console.log(`[SMS Webhook] STOP from ${from}, no matching user`);
      }
    } else if (optOutType === 'START') {
      const user = await User.findOne({
        where: { phone: from },
        attributes: ['id'],
      });

      if (user) {
        await UserSetting.update(
          { sms_notifications_enabled: true },
          { where: { user_id: user.id } }
        );
        console.log(`[SMS Webhook] START from ${from}, user ${user.id}`);
      } else {
        console.log(`[SMS Webhook] START from ${from}, no matching user`);
      }
    }

    return new NextResponse(TWIML_EMPTY, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err) {
    console.error('[SMS Webhook] Error processing webhook:', err);
    return new NextResponse(TWIML_EMPTY, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
