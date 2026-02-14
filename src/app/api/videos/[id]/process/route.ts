import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { isB2Configured } from '@/lib/storage/b2';

/**
 * POST /api/videos/[id]/process
 *
 * Background processing endpoint called after video upload.
 * Extracts thumbnail and generates captions, then updates the video record.
 *
 * This endpoint may take 10-60 seconds. The frontend should call it
 * fire-and-forget after the video metadata is saved.
 */
export const POST = withAdmin(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const { Video } = await import('@/lib/db/models');

      const params = await context.params;
      const videoId = parseInt(params.id, 10);
      if (isNaN(videoId)) {
        return errorResponse('Invalid video ID');
      }

      const video = await Video.findByPk(videoId);
      if (!video) {
        return errorResponse('Video not found', 404);
      }

      const updates: Record<string, string | null> = {};
      const log: string[] = [];

      // 1. Generate thumbnail (AI first, ffmpeg fallback)
      log.push(`[Thumbnail] Starting for video ${videoId}, URL: ${video.video_url}`);
      try {
        let thumbnailBuffer: Buffer | null = null;

        // Try AI-generated thumbnail first
        try {
          const { generateAiThumbnail, isAiThumbnailConfigured } = await import(
            '@/lib/video/ai-thumbnail'
          );

          if (isAiThumbnailConfigured) {
            log.push('[AI Thumbnail] OpenAI configured — attempting AI generation');
            const description = [video.title, video.description].filter(Boolean).join(' — ');
            thumbnailBuffer = await generateAiThumbnail(video.video_url, description);
            if (thumbnailBuffer) {
              log.push(`[AI Thumbnail] Success (${thumbnailBuffer.length} bytes)`);
            } else {
              log.push('[AI Thumbnail] Returned null — falling back to ffmpeg');
            }
          } else {
            log.push('[AI Thumbnail] OPENAI_API_KEY not set — using ffmpeg fallback');
          }
        } catch (aiErr) {
          const aiMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
          log.push(`[AI Thumbnail] Failed: ${aiMsg} — falling back to ffmpeg`);
          console.error('[Process] AI thumbnail failed:', aiErr);
        }

        // Fallback to ffmpeg frame extraction
        if (!thumbnailBuffer) {
          const { extractThumbnail } = await import('@/lib/video/thumbnail');
          thumbnailBuffer = await extractThumbnail(video.video_url);
          log.push(`[Thumbnail] ffmpeg extraction ${thumbnailBuffer ? `OK (${thumbnailBuffer.length} bytes)` : 'returned null'}`);
        }

        if (thumbnailBuffer && isB2Configured) {
          const { PutObjectCommand } = await import('@aws-sdk/client-s3');
          const { b2Client, B2_BUCKET } = await import('@/lib/storage/b2');
          const { getPublicUrl } = await import('@/lib/storage/presign');

          if (b2Client) {
            const thumbnailKey = `videos/thumbnails/${videoId}-thumb.webp`;
            await b2Client.send(
              new PutObjectCommand({
                Bucket: B2_BUCKET,
                Key: thumbnailKey,
                Body: thumbnailBuffer,
                ContentType: 'image/webp',
              })
            );
            updates.thumbnail_url = getPublicUrl(thumbnailKey);
            log.push(`[Thumbnail] Uploaded to B2: ${thumbnailKey}`);
          } else {
            log.push('[Thumbnail] B2 client not initialized');
          }
        } else if (!isB2Configured) {
          log.push('[Thumbnail] B2 not configured — skipping upload');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.push(`[Thumbnail] FAILED: ${msg}`);
        console.error('[Process] Thumbnail generation failed:', err);
      }

      // 2. Generate captions
      log.push(`[Captions] Starting for video ${videoId}`);
      try {
        const { generateCaptions, isCaptionConfigured } = await import(
          '@/lib/video/captions'
        );

        if (isCaptionConfigured) {
          log.push('[Captions] Caption service configured');
          const captionVtt = await generateCaptions(video.video_url);
          log.push(`[Captions] Generation ${captionVtt ? `OK (${captionVtt.length} chars)` : 'returned null'}`);

          if (captionVtt && isB2Configured) {
            const { PutObjectCommand } = await import('@aws-sdk/client-s3');
            const { b2Client, B2_BUCKET } = await import('@/lib/storage/b2');
            const { getPublicUrl } = await import('@/lib/storage/presign');

            if (b2Client) {
              const captionKey = `videos/captions/${videoId}.vtt`;
              const captionBuffer = Buffer.from(captionVtt, 'utf-8');
              await b2Client.send(
                new PutObjectCommand({
                  Bucket: B2_BUCKET,
                  Key: captionKey,
                  Body: captionBuffer,
                  ContentType: 'text/vtt',
                })
              );
              updates.caption_url = getPublicUrl(captionKey);
              log.push(`[Captions] Uploaded to B2: ${captionKey}`);
            } else {
              log.push('[Captions] B2 client not initialized');
            }
          }
        } else {
          log.push('[Captions] Caption service not configured — skipping');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.push(`[Captions] FAILED: ${msg}`);
        console.error('[Process] Caption generation failed:', err);
      }

      // 3. Update video record with any new URLs
      if (Object.keys(updates).length > 0) {
        await video.update(updates);
        log.push(`[DB] Updated video with: ${Object.keys(updates).join(', ')}`);
      } else {
        log.push('[DB] No updates to apply');
      }

      // Reload for response
      const updated = await Video.findByPk(videoId);

      return successResponse({
        video: updated,
        processed: {
          thumbnail: Boolean(updates.thumbnail_url),
          captions: Boolean(updates.caption_url),
        },
        log,
      });
    } catch (error) {
      return serverError(error, 'Failed to process video');
    }
  }
);
