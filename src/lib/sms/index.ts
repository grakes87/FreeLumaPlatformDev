import twilio from 'twilio';

type TwilioClient = ReturnType<typeof twilio>;

let client: TwilioClient | null = null;

/**
 * Get or create the Twilio client singleton.
 * Returns null when credentials are not configured (dev mode).
 */
function getClient(): TwilioClient | null {
  if (client) return client;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) return null;

  client = twilio(accountSid, authToken);
  return client;
}

/**
 * Parse the dev whitelist from SMS_DEV_WHITELIST env var.
 * Returns null if not set (meaning all numbers allowed).
 */
function getDevWhitelist(): Set<string> | null {
  const whitelist = process.env.SMS_DEV_WHITELIST;
  if (!whitelist) return null;
  return new Set(whitelist.split(',').map((n) => n.trim()));
}

/**
 * Send an SMS message via Twilio.
 * Falls back to console logging when Twilio is not configured.
 * Respects SMS_DEV_WHITELIST when set.
 */
export async function sendSMS(
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string }> {
  const twilioClient = getClient();

  // Dev fallback: log SMS to console if Twilio not configured
  if (!twilioClient) {
    console.log('\n========== SMS (Twilio not configured) ==========');
    console.log(`To: ${to}`);
    console.log(`Body: ${body}`);
    console.log('==================================================\n');
    return { success: false };
  }

  // Whitelist guard: if SMS_DEV_WHITELIST is set, only send to listed numbers
  const whitelist = getDevWhitelist();
  if (whitelist && !whitelist.has(to)) {
    console.log(`[SMS] Skipped (not in whitelist): ${to}`);
    return { success: false };
  }

  try {
    const message = await twilioClient.messages.create({
      body,
      to,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    });

    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('[SMS] Twilio send error:', error);
    return { success: false };
  }
}
