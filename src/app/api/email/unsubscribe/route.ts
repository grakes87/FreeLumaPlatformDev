import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const BRAND_COLOR = '#62BEBA';
const BRAND_NAME = 'Free Luma';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Valid email categories that can be unsubscribed from.
 * Maps to the UserSetting columns: email_{category}_notifications / email_daily_reminder.
 */
const CATEGORY_TO_SETTING: Record<string, string> = {
  dm: 'email_dm_notifications',
  follow: 'email_follow_notifications',
  prayer: 'email_prayer_notifications',
  daily_reminder: 'email_daily_reminder',
};

const CATEGORY_LABELS: Record<string, string> = {
  dm: 'Direct Message',
  follow: 'Follow Request',
  prayer: 'Prayer Response',
  daily_reminder: 'Daily Reminder',
};

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(jwtSecret);
}

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - ${BRAND_NAME}</title>
  <style>
    body { margin:0; padding:40px 20px; background:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    .card { max-width:480px; margin:0 auto; background:#fff; border-radius:12px; padding:40px; box-shadow:0 1px 3px rgba(0,0,0,0.08); text-align:center; }
    h1 { color:${BRAND_COLOR}; font-size:24px; margin:0 0 8px; }
    h2 { color:#18181b; font-size:20px; margin:24px 0 16px; }
    p { color:#3f3f46; font-size:15px; line-height:1.6; margin:0 0 16px; }
    a.btn { display:inline-block; padding:12px 28px; background:${BRAND_COLOR}; color:#fff; font-size:14px; font-weight:600; text-decoration:none; border-radius:8px; margin-top:8px; }
    .muted { color:#9ca3af; font-size:13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${BRAND_NAME}</h1>
    ${body}
  </div>
</body>
</html>`;
}

/**
 * GET /api/email/unsubscribe?token=<jwt>&category=<category>
 *
 * One-click email unsubscribe. No authentication required (clicked from email links).
 * Token is a purpose-scoped JWT containing userId and category.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const category = req.nextUrl.searchParams.get('category');

  // Validate inputs
  if (!token || !category) {
    const body = `
      <h2>Invalid Link</h2>
      <p>This unsubscribe link is missing required information.</p>
      <a class="btn" href="${APP_URL}/settings">Manage Settings</a>
    `;
    return new NextResponse(htmlPage('Invalid Link', body), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const settingColumn = CATEGORY_TO_SETTING[category];
  if (!settingColumn) {
    const body = `
      <h2>Unknown Category</h2>
      <p>The email category "${category}" is not recognized.</p>
      <a class="btn" href="${APP_URL}/settings">Manage Settings</a>
    `;
    return new NextResponse(htmlPage('Unknown Category', body), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Verify JWT token
  try {
    const { payload } = await jwtVerify(token, getSecret());

    // Validate purpose scope
    if (payload.purpose !== 'email_unsubscribe') {
      throw new Error('Invalid token purpose');
    }

    const userId = payload.user_id as number;
    if (!userId) throw new Error('Missing user_id in token');

    // Update user setting to disable this email category
    const { UserSetting } = await import('@/lib/db/models');
    await UserSetting.update(
      { [settingColumn]: false },
      { where: { user_id: userId } }
    );

    const categoryLabel = CATEGORY_LABELS[category] || category;
    const body = `
      <h2>Unsubscribed</h2>
      <p>You have been unsubscribed from <strong>${categoryLabel}</strong> emails.</p>
      <p class="muted">You can re-enable these notifications anytime in your settings.</p>
      <a class="btn" href="${APP_URL}/settings">Manage Settings</a>
    `;
    return new NextResponse(htmlPage('Unsubscribed', body), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch {
    const body = `
      <h2>Link Expired</h2>
      <p>This unsubscribe link has expired or is invalid.</p>
      <p class="muted">You can manage your email preferences in your account settings.</p>
      <a class="btn" href="${APP_URL}/settings">Manage Settings</a>
    `;
    return new NextResponse(htmlPage('Link Expired', body), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
