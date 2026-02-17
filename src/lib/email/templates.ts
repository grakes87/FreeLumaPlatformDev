const BRAND_COLOR = '#62BEBA';
const BRAND_NAME = 'Free Luma';

const APP_URL = 'https://freeluma.com';

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

// ---- Account lifecycle templates ----

export function accountDeletionTemplate(displayName: string, deletionDate: string, loginUrl: string): string {
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Account Deletion Scheduled</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${displayName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Your ${BRAND_NAME} account is scheduled for permanent deletion on <strong>${deletionDate}</strong>.
    </p>
    <div style="padding:16px;background:#fef2f2;border-radius:8px;border-left:3px solid #ef4444;margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.5;">
        After this date, your account and all associated data will be permanently removed. This action cannot be undone.
      </p>
    </div>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Changed your mind? Simply <strong>log in</strong> before the deletion date to cancel and restore your account.
    </p>
    ${actionButton(loginUrl, 'Log In to Cancel')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      If you intended to delete your account, no further action is needed. Your account will be removed automatically.
    </p>
  `;
  return baseTemplate(content);
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

export interface ReactionCommentBatchEmailParams {
  recipientName: string;
  items: Array<{
    type: 'reaction' | 'comment' | 'reply';
    actorName: string;
    contentPreview: string;
    emoji?: string;
    contentUrl: string;
  }>;
  trackingId?: string;
  unsubscribeUrl?: string;
}

export function reactionCommentBatchEmail(params: ReactionCommentBatchEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, items, trackingId, unsubscribeUrl } = params;

  // Count reactions and comments/replies separately for subject line
  const reactionCount = items.filter(i => i.type === 'reaction').length;
  const commentCount = items.filter(i => i.type === 'comment' || i.type === 'reply').length;

  const parts: string[] = [];
  if (reactionCount > 0) parts.push(`${reactionCount} new reaction${reactionCount > 1 ? 's' : ''}`);
  if (commentCount > 0) parts.push(`${commentCount} new comment${commentCount > 1 ? 's' : ''}`);
  const subject = `You have ${parts.join(' and ')} - ${BRAND_NAME}`;

  // Show max 5 items, with overflow
  const displayItems = items.slice(0, 5);
  const overflowCount = items.length - displayItems.length;

  const itemsHtml = displayItems.map(item => {
    const borderColor = item.type === 'reaction' ? BRAND_COLOR : '#3b82f6';

    let description: string;
    if (item.type === 'reaction') {
      description = `<strong>${item.actorName}</strong> reacted ${item.emoji || ''} to your post`;
    } else if (item.type === 'comment') {
      description = `<strong>${item.actorName}</strong> commented on your post`;
    } else {
      description = `<strong>${item.actorName}</strong> replied to your comment`;
    }

    const preview = item.contentPreview.length > 80
      ? item.contentPreview.slice(0, 77) + '...'
      : item.contentPreview;

    return `
      <div style="padding:12px 16px;background:#f9fafb;border-radius:8px;border-left:3px solid ${borderColor};margin:0 0 8px;">
        <p style="margin:0 0 4px;font-size:14px;color:#3f3f46;line-height:1.5;">
          ${description}
        </p>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.4;font-style:italic;">
          "${preview}"
        </p>
        <a href="${item.contentUrl}" style="font-size:12px;color:${BRAND_COLOR};text-decoration:none;margin-top:4px;display:inline-block;">View &rarr;</a>
      </div>`;
  }).join('');

  const overflowHtml = overflowCount > 0
    ? `<p style="margin:8px 0 0;font-size:13px;color:#71717a;text-align:center;">and ${overflowCount} more...</p>`
    : '';

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Activity on Your Content</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Here's what happened while you were away:
    </p>
    ${itemsHtml}
    ${overflowHtml}
    ${actionButton(`${APP_URL}/notifications`, 'View Activity')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      Stay connected with your community.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'Reaction & Comment' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}

// ---- Workshop lifecycle templates ----

export interface WorkshopEmailParams {
  recipientName: string;
  workshopTitle: string;
  workshopUrl: string;
  hostName: string;
  scheduledAt?: string;
  trackingId?: string;
  unsubscribeUrl?: string;
}

export function workshopReminderEmail(params: WorkshopEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, workshopTitle, workshopUrl, hostName, scheduledAt, trackingId, unsubscribeUrl } = params;

  const subject = `Reminder: ${workshopTitle} starts in 1 hour`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Workshop Reminder</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Your workshop <strong>${workshopTitle}</strong> hosted by <strong>${hostName}</strong> is starting soon at <strong>${scheduledAt}</strong>.
    </p>
    <div style="padding:16px;background:#f5f3ff;border-radius:8px;border-left:3px solid #8b5cf6;margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#52525b;line-height:1.5;">
        Make sure you&rsquo;re ready to join when the session begins.
      </p>
    </div>
    ${actionButton(workshopUrl, 'Join Workshop')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      We look forward to seeing you there.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'Workshop' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}

export function workshopCancelledEmail(params: WorkshopEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, workshopTitle, hostName, trackingId, unsubscribeUrl } = params;

  const subject = `${workshopTitle} has been cancelled`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Workshop Cancelled</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      The workshop <strong>${workshopTitle}</strong> hosted by <strong>${hostName}</strong> has been cancelled.
    </p>
    <div style="padding:16px;background:#fef2f2;border-radius:8px;border-left:3px solid #ef4444;margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.5;">
        This workshop will no longer take place. We apologize for any inconvenience.
      </p>
    </div>
    ${actionButton(`${APP_URL}/workshops`, 'Browse Workshops')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      Check out other upcoming workshops in the community.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'Workshop' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}

export function workshopInviteEmail(params: WorkshopEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, workshopTitle, workshopUrl, hostName, scheduledAt, trackingId, unsubscribeUrl } = params;

  const subject = `You're invited to ${workshopTitle}`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Workshop Invitation</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      <strong>${hostName}</strong> has invited you to their workshop <strong>${workshopTitle}</strong> scheduled for <strong>${scheduledAt}</strong>.
    </p>
    <div style="padding:16px;background:#f0fdfa;border-radius:8px;border-left:3px solid ${BRAND_COLOR};margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#52525b;line-height:1.5;">
        Join the workshop to learn, grow, and connect with the community.
      </p>
    </div>
    ${actionButton(workshopUrl, 'View Workshop')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      RSVP to secure your spot.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'Workshop' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}

export interface WorkshopRecordingEmailParams extends WorkshopEmailParams {
  recordingUrl?: string;
}

export function workshopRecordingEmail(params: WorkshopRecordingEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, workshopTitle, workshopUrl, trackingId, unsubscribeUrl, recordingUrl } = params;

  const subject = `Recording available: ${workshopTitle}`;
  const targetUrl = recordingUrl || workshopUrl;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Workshop Recording</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      The recording from <strong>${workshopTitle}</strong> is now available to watch.
    </p>
    <div style="padding:16px;background:#f0fdfa;border-radius:8px;border-left:3px solid ${BRAND_COLOR};margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#52525b;line-height:1.5;">
        Watch at your own pace and revisit the key moments.
      </p>
    </div>
    ${actionButton(targetUrl, 'Watch Recording')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      Available to watch anytime.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'Workshop' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}

export function workshopUpdatedEmail(params: WorkshopEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, workshopTitle, workshopUrl, hostName, scheduledAt, trackingId, unsubscribeUrl } = params;

  const subject = `${workshopTitle} has been updated`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Workshop Updated</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      The workshop <strong>${workshopTitle}</strong> by <strong>${hostName}</strong> has been updated. The workshop is now scheduled for <strong>${scheduledAt}</strong>.
    </p>
    <div style="padding:16px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.5;">
        Please review the updated details to stay informed.
      </p>
    </div>
    ${actionButton(workshopUrl, 'View Details')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      Check the latest schedule and details.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'Workshop' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}

export function workshopStartedEmail(params: WorkshopEmailParams): { html: string; subject: string; headers: Record<string, string> } {
  const { recipientName, workshopTitle, workshopUrl, hostName, trackingId, unsubscribeUrl } = params;

  const subject = `${workshopTitle} is live now!`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Workshop Live Now</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${recipientName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      <strong>${workshopTitle}</strong> hosted by <strong>${hostName}</strong> has just started! Join now to participate.
    </p>
    <div style="padding:16px;background:#f0fdf4;border-radius:8px;border-left:3px solid #22c55e;margin:0 0 16px;">
      <p style="margin:0;font-size:14px;color:#166534;line-height:1.5;">
        The session is live and waiting for you.
      </p>
    </div>
    ${actionButton(workshopUrl, 'Join Now')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      Don&rsquo;t miss out on this live session.
    </p>
  `;

  const footer = notificationFooter({ trackingId, unsubscribeUrl, category: 'Workshop' });

  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return { html: baseTemplate(content, footer), subject, headers };
}

// ---- Daily reminder template ----

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
