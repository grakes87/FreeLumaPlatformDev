import { NextRequest, NextResponse } from 'next/server';

/**
 * HeyGen webhook payload — actual format from HeyGen's servers:
 *
 * Success: { event_type: "avatar_video.success", event_data: { video_id, url, gif_download_url, ... } }
 * Failed:  { event_type: "avatar_video.fail", event_data: { video_id, error, ... } }
 *
 * Also handles legacy/per-video callback format:
 *   { data: { video_id, status, video_url, error } }
 *   { video_id, status, url, error }
 */
interface HeygenWebhookPayload {
  event_type?: string;
  event_data?: {
    video_id?: string;
    url?: string;
    gif_download_url?: string;
    error?: string;
    [key: string]: unknown;
  };
  data?: {
    video_id?: string;
    status?: string;
    video_url?: string;
    error?: string;
    thumbnail_url?: string;
  };
  video_id?: string;
  status?: string;
  url?: string;
  error?: string;
}

interface PendingVideoMap {
  [videoId: string]: {
    dailyContentId: number;
    creatorId: number;
    creatorName: string;
    logId?: number;
    triggeredAt: string;
  };
}

/**
 * Derive a normalized status from any HeyGen payload format.
 */
function deriveStatus(body: HeygenWebhookPayload): 'completed' | 'failed' | 'processing' | 'unknown' {
  // 1. event_type format (actual HeyGen webhook)
  const eventType = (body.event_type || '').toLowerCase();
  if (eventType.includes('success') || eventType.includes('complete')) return 'completed';
  if (eventType.includes('fail') || eventType.includes('error')) return 'failed';
  if (eventType.includes('processing') || eventType.includes('pending')) return 'processing';

  // 2. Legacy data.status or top-level status
  const rawStatus = (body.data?.status || body.status || '').toLowerCase();
  if (rawStatus === 'completed' || rawStatus === 'done') return 'completed';
  if (rawStatus === 'failed' || rawStatus === 'error') return 'failed';
  if (rawStatus === 'processing' || rawStatus === 'pending' || rawStatus === 'rendering') return 'processing';

  return 'unknown';
}

/**
 * POST /api/webhooks/heygen
 * HeyGen completion webhook - called when video generation completes or fails.
 *
 * NO auth middleware - this is called by HeyGen's servers.
 * Always returns 200 to acknowledge receipt.
 *
 * Primary lookup: ContentGenerationLog.heygen_video_id (race-condition-free)
 * Fallback: PlatformSetting heygen_pending_videos map (legacy)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: HeygenWebhookPayload = await req.json();

    console.log('[HeyGen Webhook] Received:', JSON.stringify(body).slice(0, 500));

    // Extract video ID from any format: event_data, data, or top-level
    const videoId = body.event_data?.video_id || body.data?.video_id || body.video_id;
    // Extract video URL from any format
    const videoUrl = body.event_data?.url || body.data?.video_url || body.url;
    // Extract error from any format
    const errorMsg = body.event_data?.error || body.data?.error || body.error;
    // Extract thumbnail/gif
    const thumbnailUrl = body.event_data?.gif_download_url || body.data?.thumbnail_url;

    if (!videoId) {
      console.warn('[HeyGen Webhook] No video_id found in payload');
      return NextResponse.json({ ok: true, message: 'No video_id found' }, { status: 200 });
    }

    const status = deriveStatus(body);
    console.log(`[HeyGen Webhook] video_id=${videoId} status=${status} url=${videoUrl ? 'yes' : 'no'}`);

    // Skip non-video events (e.g. gif generation)
    const eventType = (body.event_type || '').toLowerCase();
    if (eventType && !eventType.includes('avatar_video.')) {
      console.log(`[HeyGen Webhook] Ignoring non-video event: ${body.event_type}`);
      return NextResponse.json({ ok: true, message: 'Non-video event ignored' }, { status: 200 });
    }

    // Lazy-import models
    const { DailyContent, PlatformSetting, ContentGenerationLog } = await import('@/lib/db/models');

    // --- Primary lookup: find log entry by heygen_video_id column ---
    const logEntry = await ContentGenerationLog.findOne({
      where: { heygen_video_id: videoId, status: 'started' },
      order: [['id', 'DESC']],
    });

    if (logEntry) {
      const dailyContentId = logEntry.daily_content_id;
      const durationMs = Date.now() - new Date(logEntry.created_at).getTime();

      if (status === 'completed') {
        if (videoUrl) {
          await DailyContent.update(
            {
              lumashort_video_url: videoUrl,
              ...(thumbnailUrl ? { creator_video_thumbnail: thumbnailUrl } : {}),
              status: 'submitted',
            },
            { where: { id: dailyContentId } },
          );
          console.log(`[HeyGen Webhook] Updated content ${dailyContentId} with video URL, status -> submitted`);
        } else {
          console.warn(`[HeyGen Webhook] Completed but no video_url for video_id=${videoId}, content ${dailyContentId}`);
        }

        await logEntry.update({ status: 'success', duration_ms: durationMs });
      } else if (status === 'failed') {
        console.error(`[HeyGen Webhook] Video failed: video_id=${videoId}, content=${dailyContentId}, error=${errorMsg || 'unknown'}`);
        await logEntry.update({
          status: 'failed',
          error_message: errorMsg || 'HeyGen video generation failed',
          duration_ms: durationMs,
        });
      } else {
        console.log(`[HeyGen Webhook] In-progress status="${status}" for video_id=${videoId}, content=${dailyContentId}`);
        // Don't update log yet — wait for final status
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      // Clean up pending map (best-effort, non-blocking)
      try {
        const pendingJson = await PlatformSetting.get('heygen_pending_videos');
        if (pendingJson) {
          const pendingMap: PendingVideoMap = JSON.parse(pendingJson);
          if (pendingMap[videoId]) {
            delete pendingMap[videoId];
            await PlatformSetting.set('heygen_pending_videos', JSON.stringify(pendingMap));
          }
        }
      } catch (e) {
        console.warn('[HeyGen Webhook] Failed to clean pending map (non-critical):', e);
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // --- Fallback: legacy pending map lookup (for entries without heygen_video_id) ---
    const pendingJson = await PlatformSetting.get('heygen_pending_videos');
    if (!pendingJson) {
      console.warn(`[HeyGen Webhook] No log entry or pending map for video_id=${videoId}`);
      return NextResponse.json({ ok: true, message: 'Video not tracked' }, { status: 200 });
    }

    const pendingMap: PendingVideoMap = JSON.parse(pendingJson);
    const entry = pendingMap[videoId];

    if (!entry) {
      console.warn(`[HeyGen Webhook] Unknown video_id=${videoId}, not in log table or pending map`);
      return NextResponse.json({ ok: true, message: 'Video not tracked' }, { status: 200 });
    }

    // Legacy path: use pending map entry
    if (status === 'completed') {
      if (videoUrl) {
        await DailyContent.update(
          {
            lumashort_video_url: videoUrl,
            ...(thumbnailUrl ? { creator_video_thumbnail: thumbnailUrl } : {}),
            status: 'submitted',
          },
          { where: { id: entry.dailyContentId } },
        );
        console.log(`[HeyGen Webhook] (legacy) Updated content ${entry.dailyContentId} with video URL`);
      }

      if (entry.logId) {
        const legacyLog = await ContentGenerationLog.findByPk(entry.logId);
        if (legacyLog) {
          const durationMs = Date.now() - new Date(entry.triggeredAt).getTime();
          await legacyLog.update({ status: 'success', duration_ms: durationMs });
        }
      }

      delete pendingMap[videoId];
      await PlatformSetting.set('heygen_pending_videos', JSON.stringify(pendingMap));
    } else if (status === 'failed') {
      console.error(
        `[HeyGen Webhook] (legacy) Video failed: video_id=${videoId}, content=${entry.dailyContentId}, error=${errorMsg || 'unknown'}`,
      );

      if (entry.logId) {
        const legacyLog = await ContentGenerationLog.findByPk(entry.logId);
        if (legacyLog) {
          const durationMs = Date.now() - new Date(entry.triggeredAt).getTime();
          await legacyLog.update({
            status: 'failed',
            error_message: errorMsg || 'HeyGen video generation failed',
            duration_ms: durationMs,
          });
        }
      }

      delete pendingMap[videoId];
      await PlatformSetting.set('heygen_pending_videos', JSON.stringify(pendingMap));
    } else {
      console.log(`[HeyGen Webhook] (legacy) In-progress status="${status}" for video_id=${videoId}`);
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
