import twilio from 'twilio';

/**
 * Send an OTP verification code to a phone number via Twilio Verify.
 * Falls back to simulated mode when Twilio is not configured (dev mode).
 */
export async function sendOTP(
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifySid) {
    console.log(
      `[SMS Verify] Twilio not configured, OTP to ${phoneNumber}: simulated`
    );
    return { success: true };
  }

  try {
    const client = twilio(accountSid, authToken);
    const verification = await client.verify.v2
      .services(verifySid)
      .verifications.create({ channel: 'sms', to: phoneNumber });

    return { success: verification.status === 'pending' };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error sending OTP';
    console.error('[SMS Verify] Send OTP error:', message);
    return { success: false, error: message };
  }
}

/**
 * Check an OTP verification code against Twilio Verify.
 * In dev mode (Twilio not configured), accepts '000000' as a magic code.
 */
export async function checkOTP(
  phoneNumber: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifySid) {
    // Dev mode: accept magic code '000000'
    if (code === '000000') {
      return { success: true };
    }
    return { success: false, error: 'Invalid code' };
  }

  try {
    const client = twilio(accountSid, authToken);
    const check = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({ to: phoneNumber, code });

    return { success: check.status === 'approved' };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error checking OTP';
    console.error('[SMS Verify] Check OTP error:', message);
    return { success: false, error: message };
  }
}
