const BRAND_COLOR = '#62BEBA';
const BRAND_NAME = 'Free Luma';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function baseTemplate(content: string, footer?: string): string {
  const footerHtml = footer || `
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.<br />
                Daily inspiration and faith-based community.
              </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:${BRAND_COLOR};">${BRAND_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:24px 32px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function actionButton(url: string, label: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:24px 0;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;background:${BRAND_COLOR};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

/**
 * Build the footer HTML with tracking pixel, unsubscribe link, and copyright.
 */
function notificationFooter(params: {
  trackingId?: string;
  unsubscribeUrl?: string;
  category?: string;
}): string {
  const { trackingId, unsubscribeUrl, category } = params;

  let html = '';

  // Unsubscribe link
  if (unsubscribeUrl) {
    const categoryLabel = category
      ? category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'these';
    html += `<p style="margin:0 0 12px;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe from ${categoryLabel} emails</a>
              </p>`;
  }

  // Copyright
  html += `<p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.<br />
                Daily inspiration and faith-based community.
              </p>`;

  // Tracking pixel (at the very end of the footer)
  if (trackingId) {
    html += `<img src="${APP_URL}/api/email/track?id=${trackingId}" width="1" height="1" alt="" style="display:block;" />`;
  }

  return html;
}

// ---- Existing templates ----

export function passwordResetTemplate(resetUrl: string): string {
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Reset Your Password</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      We received a request to reset your password. Click the button below to create a new password.
    </p>
    ${actionButton(resetUrl, 'Reset Password')}
    <p style="margin:0 0 8px;font-size:13px;color:#71717a;line-height:1.5;">
      This link expires in <strong>1 hour</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      If you didn&rsquo;t request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">
      If the button doesn&rsquo;t work, copy and paste this URL into your browser:<br />
      <a href="${resetUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${resetUrl}</a>
    </p>
  `;
  return baseTemplate(content);
}

export function verificationTemplate(verifyUrl: string): string {
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Verify Your Email</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Thanks for signing up! Please verify your email address to secure your account.
    </p>
    ${actionButton(verifyUrl, 'Verify Email')}
    <p style="margin:0 0 8px;font-size:13px;color:#71717a;line-height:1.5;">
      This link expires in <strong>24 hours</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      If you didn&rsquo;t create an account, you can safely ignore this email.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">
      If the button doesn&rsquo;t work, copy and paste this URL into your browser:<br />
      <a href="${verifyUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${verifyUrl}</a>
    </p>
  `;
  return baseTemplate(content);
}

// ---- Notification email templates ----

export interface DmBatchEmailParams {
  recipientName: string;
  senderName: string;
  messageCount: number;
  messagePreview: string;
  conversationUrl: string;
  trackingId?: string;
  unsubscribeUrl?: string;
}

export function dmBatchEmail(params: DmBatchEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, senderName, messageCount, messagePreview, conversationUrl, trackingId, unsubscribeUrl } = params;

  const subject = `You have ${messageCount} unread message${messageCount > 1 ? 's' : ''} from ${senderName}`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">New Messages</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      You have <strong>${messageCount}</strong> unread message${messageCount > 1 ? 's' : ''} from <strong>${senderName}</strong>.
    </p>
    <div style="padding:16px;background:#f9fafb;border-radius:8px;border-left:3px solid ${BRAND_COLOR};margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#52525b;line-height:1.5;font-style:italic;">
        "${messagePreview}"
      </p>
    </div>
    ${actionButton(conversationUrl, 'Reply in App')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      Open the conversation to see all messages and reply.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'DM' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}

export interface FollowRequestEmailParams {
  recipientName: string;
  actorName: string;
  actorAvatarUrl: string | null;
  profileUrl: string;
  trackingId?: string;
  unsubscribeUrl?: string;
}

export function followRequestEmail(params: FollowRequestEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, actorName, profileUrl, trackingId, unsubscribeUrl } = params;

  const subject = `${actorName} wants to follow you on ${BRAND_NAME}`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">New Follow Request</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      <strong>${actorName}</strong> wants to follow you. View their profile to accept or decline the request.
    </p>
    ${actionButton(profileUrl, 'View Request')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      You can manage follow requests in the app.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'Follow' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}

export interface PrayerResponseEmailParams {
  recipientName: string;
  actorName: string;
  prayerTitle: string;
  prayerUrl: string;
  trackingId?: string;
  unsubscribeUrl?: string;
}

export function prayerResponseEmail(params: PrayerResponseEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, actorName, prayerTitle, prayerUrl, trackingId, unsubscribeUrl } = params;

  const subject = `${actorName} prayed for your request`;

  const truncatedTitle = prayerTitle.length > 80 ? prayerTitle.slice(0, 77) + '...' : prayerTitle;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Prayer Support</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      <strong>${actorName}</strong> prayed for your request:
    </p>
    <div style="padding:16px;background:#f5f3ff;border-radius:8px;border-left:3px solid #8b5cf6;margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#52525b;line-height:1.5;">
        "${truncatedTitle}"
      </p>
    </div>
    ${actionButton(prayerUrl, 'View Prayer Request')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      Your community is praying with you.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'Prayer' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}

// ---- Account security templates ----

export function emailChangeVerificationTemplate(newEmail: string, verifyUrl: string): string {
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Verify Your New Email Address</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      You requested to change your email address to <strong>${newEmail}</strong>. Click the button below to confirm this change.
    </p>
    ${actionButton(verifyUrl, 'Verify New Email')}
    <p style="margin:0 0 8px;font-size:13px;color:#71717a;line-height:1.5;">
      This link expires in <strong>24 hours</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      If you didn&rsquo;t request this change, you can safely ignore this email. Your account email will remain unchanged.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">
      If the button doesn&rsquo;t work, copy and paste this URL into your browser:<br />
      <a href="${verifyUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${verifyUrl}</a>
    </p>
  `;
  return baseTemplate(content);
}

export function emailChangeAlertTemplate(oldEmail: string, newEmail: string): string {
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Email Address Changed</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Your ${BRAND_NAME} account email was changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>.
    </p>
    <div style="padding:16px;background:#fef2f2;border-radius:8px;border-left:3px solid #ef4444;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.5;">
        If you did not make this change, please contact support immediately to secure your account.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      This is an automated security alert. No action is needed if you made this change.
    </p>
  `;
  return baseTemplate(content);
}

export function passwordChangeAlertTemplate(email: string): string {
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Password Changed</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      The password for your ${BRAND_NAME} account (${email}) was recently changed.
    </p>
    <div style="padding:16px;background:#fef2f2;border-radius:8px;border-left:3px solid #ef4444;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.5;">
        If you did not make this change, please reset your password immediately or contact support to secure your account.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      This is an automated security alert. No action is needed if you made this change.
    </p>
  `;
  return baseTemplate(content);
}

export interface DailyReminderEmailParams {
  recipientName: string;
  verseText: string;
  verseReference: string;
  dailyUrl: string;
  trackingId?: string;
  unsubscribeUrl?: string;
}

export function dailyReminderEmail(params: DailyReminderEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, verseText, verseReference, dailyUrl, trackingId, unsubscribeUrl } = params;

  const subject = `Your daily inspiration is ready - ${BRAND_NAME}`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Daily Inspiration</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Your daily inspiration is ready. Here is a preview:
    </p>
    <div style="padding:20px;background:linear-gradient(135deg, #f0fdfa 0%, #f5f3ff 100%);border-radius:8px;margin:0 0 16px;text-align:center;">
      <p style="margin:0 0 8px;font-size:16px;color:#18181b;line-height:1.6;font-style:italic;">
        "${verseText}"
      </p>
      <p style="margin:0;font-size:13px;color:#71717a;font-weight:600;">
        ${verseReference}
      </p>
    </div>
    ${actionButton(dailyUrl, 'Read More')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      Start your day with faith and inspiration.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'Daily Reminder' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}
