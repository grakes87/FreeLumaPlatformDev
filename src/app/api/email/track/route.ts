import { NextRequest, NextResponse } from 'next/server';
import { markOpened } from '@/lib/email/tracking';

/**
 * 1x1 transparent GIF pixel (43 bytes).
 * Used for email open tracking.
 */
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * GET /api/email/track?id=<tracking_id>
 *
 * Tracking pixel endpoint: records email opens.
 * No authentication required (loaded by email clients as image).
 */
export async function GET(req: NextRequest) {
  const trackingId = req.nextUrl.searchParams.get('id');

  if (trackingId) {
    // Fire-and-forget: don't block the pixel response on DB update
    markOpened(trackingId).catch(() => {
      // Silently ignore tracking errors
    });
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
