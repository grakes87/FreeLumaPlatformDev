import { sendEmail } from '@/lib/email';

const BRAND_COLOR = '#62BEBA';
const BRAND_NAME = 'Free Luma';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://freeluma.com';

function baseTemplate(content: string): string {
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
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.<br />
                Daily inspiration and faith-based community.
              </p>
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

export interface CreatorAssignmentEmailParams {
  creatorEmail: string;
  creatorName: string;
  assignmentCount: number;
  month: string;
  mode: 'bible' | 'positivity';
}

/**
 * Send an email to a creator when new scripts are assigned.
 */
export async function sendCreatorAssignmentEmail(params: CreatorAssignmentEmailParams): Promise<void> {
  const { creatorEmail, creatorName, assignmentCount, month, mode } = params;

  // Parse month string (YYYY-MM) to display name
  const [yearStr, monthStr] = month.split('-');
  const monthDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const monthDisplay = monthDate.toLocaleDateString('en-US', { month: 'long' });
  const yearDisplay = yearStr;

  const modeLabel = mode === 'bible' ? 'Bible' : 'Positivity';
  const creatorPortalUrl = `${APP_URL}/creator`;

  const subject = `New Scripts Assigned - ${monthDisplay} ${yearDisplay}`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">New Scripts Assigned</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${creatorName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      You have been assigned <strong>${assignmentCount} new script${assignmentCount > 1 ? 's' : ''}</strong> for <strong>${monthDisplay} ${yearDisplay}</strong>.
    </p>
    <div style="padding:16px;background:#f0fdfa;border-radius:8px;border-left:3px solid ${BRAND_COLOR};margin:0 0 16px;">
      <p style="margin:0 0 4px;font-size:14px;color:#52525b;line-height:1.5;">
        <strong>Mode:</strong> ${modeLabel}
      </p>
      <p style="margin:0 0 4px;font-size:14px;color:#52525b;line-height:1.5;">
        <strong>Scripts:</strong> ${assignmentCount}
      </p>
      <p style="margin:0;font-size:14px;color:#52525b;line-height:1.5;">
        <strong>Due date:</strong> ${monthDisplay} 15, ${yearDisplay}
      </p>
    </div>
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Please log in to your creator portal to view your assigned scripts and start recording.
    </p>
    ${actionButton(creatorPortalUrl, 'Open Creator Portal')}
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;text-align:center;">
      Thank you for being a ${BRAND_NAME} creator.
    </p>
  `;

  const headers: Record<string, string> = {
    'List-Unsubscribe': `<${APP_URL}/api/email/unsubscribe?category=creator>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };

  await sendEmail(creatorEmail, subject, baseTemplate(content), headers);
}
