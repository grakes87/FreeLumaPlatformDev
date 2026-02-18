import { NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { PostMedia } from '@/lib/db/models';
import { isB2Configured, b2Client, B2_BUCKET } from '@/lib/storage/b2';
import { getPublicUrl } from '@/lib/storage/presign';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * PATCH /api/posts/media/[id]/thumbnail
 *
 * Auto-capture endpoint: accepts a JPEG thumbnail blob captured client-side
 * (video first frame or downsized image), uploads to B2, and stores the URL
 * in post_media.thumbnail_url. Skips if already set (idempotent).
 */
export const PATCH = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const mediaId = parseInt(params.id, 10);
      if (isNaN(mediaId)) {
        return errorResponse('Invalid media ID', 400);
      }

      const media = await PostMedia.findByPk(mediaId);
      if (!media) {
        return errorResponse('Media not found', 404);
      }

      // Already has a thumbnail — return it (idempotent)
      if (media.thumbnail_url) {
        return successResponse({ thumbnail_url: media.thumbnail_url });
      }

      if (!isB2Configured || !b2Client) {
        return errorResponse('Storage not configured', 503);
      }

      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file || !file.type.startsWith('image/')) {
        return errorResponse('Invalid thumbnail file', 400);
      }

      if (file.size > MAX_THUMBNAIL_SIZE) {
        return errorResponse('Thumbnail too large (max 2 MB)', 400);
      }

      const random = Math.random().toString(36).slice(2, 8);
      const key = `thumbnails/${mediaId}/${Date.now()}-${random}.jpg`;
      const buffer = Buffer.from(await file.arrayBuffer());

      await b2Client.send(
        new PutObjectCommand({
          Bucket: B2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );

      const publicUrl = getPublicUrl(key);
      await media.update({ thumbnail_url: publicUrl });

      return successResponse({ thumbnail_url: publicUrl });
    } catch (error) {
      return serverError(error, 'Failed to save thumbnail');
    }
  }
);
