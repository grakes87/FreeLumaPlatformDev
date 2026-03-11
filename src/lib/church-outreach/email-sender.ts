import sgMail from '@sendgrid/mail';
import { rewriteLinksForTracking, getTrackingPixel } from './tracking';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://freeluma.app';

const OUTREACH_FROM = {
  email: process.env.OUTREACH_EMAIL_FROM || 'orders@freeluma.com',
  name: process.env.OUTREACH_EMAIL_FROM_NAME || 'Free Luma Bracelets',
};

const OUTREACH_REPLY_TO = {
  email: process.env.OUTREACH_REPLY_TO || 'outreach@freeluma.com',
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
      replyTo: OUTREACH_REPLY_TO,
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
        <p>
          <a href="${APP_URL}/api/church-outreach/unsubscribe?email=${encodeURIComponent(to)}" style="color:#888;text-decoration:underline;">Unsubscribe from future emails</a>
        </p>
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

  const unsubscribeUrl = `${APP_URL}/api/church-outreach/unsubscribe?email=${encodeURIComponent(to)}`;

  try {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }

    await sgMail.send({
      to,
      from: OUTREACH_FROM,
      replyTo: OUTREACH_REPLY_TO,
      subject,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
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

/**
 * Send a follow-up email 1 week after sample delivery.
 * Asks for feedback and presents bulk order information.
 */
export async function sendFollowUpEmail(to: string, churchName: string, pastorName: string | null): Promise<void> {
  const greeting = pastorName ? `Dear ${pastorName}` : `Dear ${churchName} Team`;
  const subject = `How are your students enjoying the Luma Bracelets? - ${churchName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#333;">${greeting},</h2>
      <p style="color:#555;line-height:1.6;">
        It&rsquo;s been about a week since your Free Luma sample bracelets were delivered,
        and we&rsquo;d love to hear how things are going!
      </p>
      <p style="color:#555;line-height:1.6;">
        <strong>We&rsquo;d love your feedback:</strong>
      </p>
      <ul style="color:#555;line-height:1.8;">
        <li>Have your students tried tapping their bracelets?</li>
        <li>What has the response been like?</li>
        <li>Is there anything we can improve?</li>
      </ul>
      <p style="color:#555;line-height:1.6;">
        Simply reply to this email with your thoughts &mdash; we read every response.
      </p>

      <div style="margin:30px 0;padding:20px;background:#FFF7ED;border-radius:12px;border:1px solid #FDBA74;">
        <h3 style="color:#C2410C;margin-top:0;">Ready to equip your whole youth group?</h3>
        <p style="color:#555;line-height:1.6;margin-bottom:15px;">
          We offer bulk orders at special church pricing. Whether you need 50 or 500 bracelets,
          we&rsquo;ll work with you to find the right fit for your ministry.
        </p>
        <a href="mailto:outreach@freeluma.com?subject=Bulk%20Order%20Inquiry%20-%20${encodeURIComponent(churchName)}"
           style="display:inline-block;background:#EA580C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Inquire About Bulk Orders
        </a>
      </div>

      <p style="color:#888;font-size:14px;margin-top:30px;">
        &mdash; The Free Luma Bracelets Team
      </p>
      <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e0e0e0;font-size:12px;color:#888;text-align:center;">
        <p>${PHYSICAL_ADDRESS}</p>
        <p>
          <a href="${APP_URL}/api/church-outreach/unsubscribe?email=${encodeURIComponent(to)}" style="color:#888;text-decoration:underline;">Unsubscribe from future emails</a>
        </p>
      </div>
    </div>
  `;

  // Dev fallback
  if (!process.env.SENDGRID_API_KEY) {
    console.log('\n========== FOLLOW-UP EMAIL (SendGrid not configured) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Church: ${churchName}`);
    console.log('================================================================\n');
    return;
  }

  const unsubscribeUrl = `${APP_URL}/api/church-outreach/unsubscribe?email=${encodeURIComponent(to)}`;

  try {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }

    await sgMail.send({
      to,
      from: OUTREACH_FROM,
      replyTo: OUTREACH_REPLY_TO,
      subject,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
    });
  } catch (error: unknown) {
    const sgError = error as { response?: { body?: unknown } };
    if (sgError.response?.body) {
      console.error('[Follow-up Email] SendGrid error details:', sgError.response.body);
    }
    throw error;
  }
}
