import { NextRequest, NextResponse } from 'next/server';

const FALLBACK_URL = 'https://freeluma.app';

/**
 * GET /api/church-outreach/click?id={emailId}&url={encodedUrl}
 *
 * Public click tracking redirect endpoint (no auth required).
 * Logs the click fire-and-forget, then redirects (302) to the target URL.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const emailId = url.searchParams.get('id');
  const targetUrl = url.searchParams.get('url');

  // Validate target URL
  let redirectTo = FALLBACK_URL;
  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      // Only allow http/https protocols
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        redirectTo = targetUrl;
      }
    } catch {
      // Malformed URL -- use fallback
    }
  }

  // Fire-and-forget: update DB in background, redirect immediately
  if (emailId) {
    (async () => {
      try {
        const { OutreachEmail, OutreachCampaign, ChurchActivity } =
          await import('@/lib/db/models');

        const email = await OutreachEmail.findByPk(Number(emailId));

        if (email && !email.clicked_at) {
          // Mark as clicked
          await email.update({ status: 'clicked', clicked_at: new Date() });

          // Also mark as opened if not already (click implies open)
          if (!email.opened_at) {
            await email.update({ opened_at: new Date() });
          }

          // Increment campaign click_count if campaign_id is set
          if (email.campaign_id) {
            await OutreachCampaign.increment('click_count', {
              where: { id: email.campaign_id },
            });
          }

          // Log activity
          ChurchActivity.create({
            church_id: email.church_id,
            activity_type: 'email_clicked',
            description: `Email link clicked: "${email.subject}"`,
            metadata: {
              outreach_email_id: email.id,
              campaign_id: email.campaign_id,
              url: redirectTo,
            },
          }).catch((err: unknown) => {
            console.error('[Click Track] Activity log error:', err);
          });
        }
      } catch (err) {
        console.error('[Click Track] Error updating click status:', err);
      }
    })();
  }

  return NextResponse.redirect(redirectTo, 302);
}
