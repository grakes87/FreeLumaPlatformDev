import sgMail from '@sendgrid/mail';
import { rewriteLinksForTracking, getTrackingPixel } from './tracking';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://freeluma.app';

const OUTREACH_FROM = {
  email: process.env.OUTREACH_EMAIL_FROM || 'outreach@freelumabracelets.com',
  name: process.env.OUTREACH_EMAIL_FROM_NAME || 'Free Luma Bracelets',
};

// CAN-SPAM required physical address
const PHYSICAL_ADDRESS = process.env.OUTREACH_PHYSICAL_ADDRESS || '123 Main Street, City, ST 12345';

interface OutreachEmailParams {
  to: string;
  subject: string;
  html: string;
  emailId: number;        // outreach_emails.id for click tracking
  trackingId: string;     // UUID for open tracking
  churchId: number;       // for unsubscribe link
}

/**
 * Send an outreach email with click tracking, open tracking, and CAN-SPAM compliance.
 * Uses a separate sender identity from platform transactional emails.
 */
export async function sendOutreachEmail(params: OutreachEmailParams): Promise<void> {
  const { to, subject, html, emailId, trackingId, churchId } = params;

  // Dev fallback: log email to console if SendGrid not configured
  if (!process.env.SENDGRID_API_KEY) {
    console.log('\n========== OUTREACH EMAIL (SendGrid not configured) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`From: ${OUTREACH_FROM.name} <${OUTREACH_FROM.email}>`);
    console.log(`Email ID: ${emailId} | Tracking ID: ${trackingId} | Church ID: ${churchId}`);
    console.log(`HTML length: ${html.length} chars`);
    console.log('================================================================\n');
    return;
  }

  // 1. Rewrite links for click tracking
  let trackedHtml = rewriteLinksForTracking(html, emailId);

  // 2. Build unsubscribe URL
  const unsubscribeUrl = `${APP_URL}/api/church-outreach/unsubscribe?email=${encodeURIComponent(to)}`;

  // 3. Append CAN-SPAM footer
  trackedHtml += `
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e0e0e0;font-size:12px;color:#888;text-align:center;">
      <p>${PHYSICAL_ADDRESS}</p>
      <p>
        You received this email because your church was identified as a potential partner.
        <br/>
        <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Unsubscribe from future emails</a>
      </p>
    </div>
  `;

  // 4. Append tracking pixel
  trackedHtml += getTrackingPixel(trackingId);

  try {
    // Ensure API key is set
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }

    await sgMail.send({
      to,
      from: OUTREACH_FROM,
      subject,
      html: trackedHtml,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      trackingSettings: {
        // Disable SendGrid's built-in tracking (we use our own)
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
    });
  } catch (error: unknown) {
    const sgError = error as { response?: { body?: unknown } };
    if (sgError.response?.body) {
      console.error('[Outreach Email] SendGrid error details:', sgError.response.body);
    }
    throw error;
  }
}

/**
 * Send a confirmation email after sample request submission.
 * Uses the outreach sender identity but no tracking.
 */
export async function sendConfirmationEmail(to: string, churchName: string): Promise<void> {
  const subject = 'Thank You for Your Sample Request - Free Luma Bracelets';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#333;">Thank You, ${churchName}!</h2>
      <p style="color:#555;line-height:1.6;">
        We received your request for sample bracelets. Our team will review your submission
        and get back to you within a few business days.
      </p>
      <p style="color:#555;line-height:1.6;">
        In the meantime, feel free to explore the Free Luma app to see how our daily
        inspirational content can benefit your congregation.
      </p>
      <p style="color:#555;line-height:1.6;">
        If you have any questions, simply reply to this email.
      </p>
      <p style="color:#888;font-size:14px;margin-top:30px;">
        &mdash; The Free Luma Bracelets Team
      </p>
      <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e0e0e0;font-size:12px;color:#888;text-align:center;">
        <p>${PHYSICAL_ADDRESS}</p>
      </div>
    </div>
  `;

  // Dev fallback
  if (!process.env.SENDGRID_API_KEY) {
    console.log('\n========== CONFIRMATION EMAIL (SendGrid not configured) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Church: ${churchName}`);
    console.log('==================================================================\n');
    return;
  }

  try {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }

    await sgMail.send({
      to,
      from: OUTREACH_FROM,
      subject,
      html,
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
    });
  } catch (error: unknown) {
    const sgError = error as { response?: { body?: unknown } };
    if (sgError.response?.body) {
      console.error('[Confirmation Email] SendGrid error details:', sgError.response.body);
    }
    throw error;
  }
}
