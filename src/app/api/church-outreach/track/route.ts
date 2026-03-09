import { NextRequest } from 'next/server';

/**
 * 1x1 transparent GIF for email open tracking pixel.
 */
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * GET /api/church-outreach/track?id={trackingId}
 *
 * Public email open tracking pixel endpoint (no auth required).
 * Returns a 1x1 transparent GIF regardless of whether the tracking ID was found.
 * Updates the outreach email and campaign counters fire-and-forget.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const trackingId = url.searchParams.get('id');

  // Fire-and-forget: update DB in background, return GIF immediately
  if (trackingId) {
    (async () => {
      try {
        const { OutreachEmail, OutreachCampaign, ChurchActivity } =
          await import('@/lib/db/models');

        const email = await OutreachEmail.findOne({
          where: { tracking_id: trackingId },
        });

        if (email && !email.opened_at) {
          // Mark as opened
          await email.update({ status: 'opened', opened_at: new Date() });

          // Increment campaign open_count if campaign_id is set
          if (email.campaign_id) {
            await OutreachCampaign.increment('open_count', {
              where: { id: email.campaign_id },
            });
          }

          // Log activity
          ChurchActivity.create({
            church_id: email.church_id,
            activity_type: 'email_opened',
            description: `Email opened: "${email.subject}"`,
            metadata: {
              outreach_email_id: email.id,
              campaign_id: email.campaign_id,
            },
          }).catch((err: unknown) => {
            console.error('[Track Pixel] Activity log error:', err);
          });
        }
      } catch (err) {
        console.error('[Track Pixel] Error updating open status:', err);
      }
    })();
  }

  return new Response(TRANSPARENT_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store',
    },
  });
}
