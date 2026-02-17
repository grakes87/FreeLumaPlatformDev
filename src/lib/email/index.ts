import sgMail from '@sendgrid/mail';
import { passwordResetTemplate, verificationTemplate, emailChangeVerificationTemplate, passwordChangeAlertTemplate, accountDeletionTemplate } from './templates';

const APP_URL = 'https://freeluma.com';

// Set API key at module level (guarded so it does not throw if key missing)
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Parse the dev whitelist from EMAIL_DEV_WHITELIST env var.
 * Returns null if not set (meaning all emails allowed in dev).
 */
function getDevWhitelist(): Set<string> | null {
  const whitelist = process.env.EMAIL_DEV_WHITELIST;
  if (!whitelist) return null;
  return new Set(whitelist.split(',').map(e => e.trim().toLowerCase()));
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>
): Promise<void> {
  // Dev fallback: log email to console if SendGrid not configured
  if (!process.env.SENDGRID_API_KEY) {
    console.log('\n========== EMAIL (SendGrid not configured) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML length: ${html.length} chars`);
    if (headers) {
      console.log('Custom headers:', JSON.stringify(headers));
    }
    // Extract any URLs from the HTML for easy dev testing
    const urlMatch = html.match(/href="(https?:\/\/[^"]+)"/g);
    if (urlMatch) {
      console.log('Links found:');
      urlMatch.forEach((match) => {
        const url = match.replace(/href="/, '').replace(/"$/, '');
        if (
          url.includes('reset-password') ||
          url.includes('verify-email') ||
          url.includes('verify-email-change') ||
          url.includes('unsubscribe') ||
          url.includes('/chat/') ||
          url.includes('/profile/') ||
          url.includes('/prayer-wall') ||
          url.includes('/daily') ||
          url.includes('/login') ||
          url.includes('/workshop')
        ) {
          console.log(`  => ${url}`);
        }
      });
    }
    console.log('=====================================================\n');
    return;
  }

  // Dev whitelist guard: prevent accidental emails to real users in non-production
  if (process.env.NODE_ENV !== 'production') {
    const whitelist = getDevWhitelist();
    if (whitelist && !whitelist.has(to.toLowerCase())) {
      console.log(`[Email] Skipped (not in dev whitelist): ${to}`);
      return;
    }
  }

  try {
    await sgMail.send({
      to,
      from: { email: 'hello@freeluma.com', name: 'Free Luma' },
      subject,
      html,
      headers,
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
    });
  } catch (error: unknown) {
    const sgError = error as { response?: { body?: unknown } };
    if (sgError.response?.body) {
      console.error('[Email] SendGrid error details:', sgError.response.body);
    }
    throw error;
  }
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const html = passwordResetTemplate(resetUrl);
  await sendEmail(to, 'Reset Your Password - Free Luma', html);
}

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;
  const html = verificationTemplate(verifyUrl);
  await sendEmail(to, 'Verify Your Email - Free Luma', html);
}

export async function sendEmailChangeVerification(
  newEmail: string,
  token: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/api/auth/verify-email-change?token=${token}`;
  const html = emailChangeVerificationTemplate(newEmail, verifyUrl);
  await sendEmail(newEmail, 'Verify Your New Email Address - Free Luma', html);
}

export async function sendPasswordChangeAlert(
  email: string
): Promise<void> {
  const html = passwordChangeAlertTemplate(email);
  await sendEmail(email, 'Your password was changed - Free Luma', html);
}

export async function sendAccountDeletionEmail(
  email: string,
  displayName: string,
  deletionDate: Date
): Promise<void> {
  const loginUrl = `${APP_URL}/login`;
  const formattedDate = deletionDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const html = accountDeletionTemplate(displayName, formattedDate, loginUrl);
  await sendEmail(email, 'Your account is scheduled for deletion - Free Luma', html);
}
