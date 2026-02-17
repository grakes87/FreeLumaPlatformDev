import { NextRequest, NextResponse } from 'next/server';

/**
 * HeyGen webhook payload shape (partial, based on HeyGen docs).
 * The callback sends event_type + data with video_id and status.
 */
interface HeygenWebhookPayload {
  event_type?: string;
  data?: {
    video_id?: string;
    status?: string;
    video_url?: string;
    error?: string;
    thumbnail_url?: string;
  };
  // Some webhook formats send these at top level
  video_id?: string;
  status?: string;
  url?: string;
  error?: string;
}

interface PendingVideoEntry {
  dailyContentId: number;
  creatorId: number;
  creatorName: string;
  triggeredAt: string;
}

interface PendingVideoMap {
  [videoId: string]: PendingVideoEntry;
}

/**
 * POST /api/webhooks/heygen
 * HeyGen completion webhook - called when video generation completes or fails.
 *
 * NO auth middleware - this is called by HeyGen's servers.
 * Always returns 200 to acknowledge receipt.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: HeygenWebhookPayload = await req.json();

    // Extract video ID and status from either nested or flat format
    const videoId = body.data?.video_id || body.video_id;
    const status = body.data?.status || body.status;
    const videoUrl = body.data?.video_url || body.url;
    const errorMsg = body.data?.error || body.error;
    const thumbnailUrl = body.data?.thumbnail_url;

    if (!videoId) {
      console.warn('[HeyGen Webhook] Received callback without video_id:', JSON.stringify(body));
      return NextResponse.json({ ok: true, message: 'No video_id found' }, { status: 200 });
    }

    console.log(`[HeyGen Webhook] video_id=${videoId} status=${status}`);

    // Lazy-import models
    const { DailyContent, PlatformSetting } = await import('@/lib/db/models');

    // Load pending videos map
    const pendingJson = await PlatformSetting.get('heygen_pending_videos');
    if (!pendingJson) {
      console.warn(`[HeyGen Webhook] No pending videos map found for video_id=${videoId}`);
      return NextResponse.json({ ok: true, message: 'No pending videos tracked' }, { status: 200 });
    }

    const pendingMap: PendingVideoMap = JSON.parse(pendingJson);
    const entry = pendingMap[videoId];

    if (!entry) {
      console.warn(`[HeyGen Webhook] Unknown video_id=${videoId}, not in pending map`);
      return NextResponse.json({ ok: true, message: 'Video not tracked' }, { status: 200 });
    }

    const normalizedStatus = (status || '').toLowerCase();

    if (normalizedStatus === 'completed' || normalizedStatus === 'done') {
      // Video completed -- update DailyContent with video URL
      if (videoUrl) {
        await DailyContent.update(
          {
            creator_video_url: videoUrl,
            ...(thumbnailUrl ? { creator_video_thumbnail: thumbnailUrl } : {}),
            status: 'submitted',
          },
          { where: { id: entry.dailyContentId } },
        );
        console.log(
          `[HeyGen Webhook] Updated content ${entry.dailyContentId} with video URL, status -> submitted`,
        );
      } else {
        console.warn(
          `[HeyGen Webhook] Completed but no video_url for video_id=${videoId}, content ${entry.dailyContentId}`,
        );
      }

      // Remove from pending map
      delete pendingMap[videoId];
      await PlatformSetting.set('heygen_pending_videos', JSON.stringify(pendingMap));
    } else if (normalizedStatus === 'failed' || normalizedStatus === 'error') {
      // Video failed -- log error and remove from pending
      console.error(
        `[HeyGen Webhook] Video failed: video_id=${videoId}, content=${entry.dailyContentId}, ` +
        `creator=${entry.creatorName}, error=${errorMsg || 'unknown'}`,
      );

      // Remove from pending map
      delete pendingMap[videoId];
      await PlatformSetting.set('heygen_pending_videos', JSON.stringify(pendingMap));
    } else {
      // Processing/pending -- just log, keep in pending map
      console.log(
        `[HeyGen Webhook] In-progress status="${status}" for video_id=${videoId}, content=${entry.dailyContentId}`,
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[HeyGen Webhook] Error processing callback:', error);
    // Always return 200 to prevent HeyGen from retrying
    return NextResponse.json({ ok: true, message: 'Error processed' }, { status: 200 });
  }
}

/**
 * GET /api/webhooks/heygen
 * Health check / verification endpoint for webhook configuration.
 * HeyGen may ping this to verify the URL is valid.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: 'heygen-webhook' }, { status: 200 });
}
