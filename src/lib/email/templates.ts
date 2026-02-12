const BRAND_COLOR = '#6366F1';
const BRAND_NAME = 'Free Luma';

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
