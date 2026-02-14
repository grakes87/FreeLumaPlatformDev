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

      // 1. Extract thumbnail
      try {
        const { extractThumbnail } = await import('@/lib/video/thumbnail');
        const thumbnailBuffer = await extractThumbnail(video.video_url);

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
          }
        }
      } catch (err) {
        console.error('[Process] Thumbnail extraction failed:', err);
        // Non-fatal: continue to captions
      }

      // 2. Generate captions
      try {
        const { generateCaptions, isCaptionConfigured } = await import(
          '@/lib/video/captions'
        );

        if (isCaptionConfigured) {
          const captionVtt = await generateCaptions(video.video_url);

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
            }
          }
        }
      } catch (err) {
        console.error('[Process] Caption generation failed:', err);
        // Non-fatal: captions are optional
      }

      // 3. Update video record with any new URLs
      if (Object.keys(updates).length > 0) {
        await video.update(updates);
      }

      // Reload for response
      const updated = await Video.findByPk(videoId);

      return successResponse({
        video: updated,
        processed: {
          thumbnail: Boolean(updates.thumbnail_url),
          captions: Boolean(updates.caption_url),
        },
      });
    } catch (error) {
      return serverError(error, 'Failed to process video');
    }
  }
);
