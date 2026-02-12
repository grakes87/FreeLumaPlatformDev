import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { isB2Configured } from '@/lib/storage/b2';
import { getUploadUrl, getPublicUrl, generateKey } from '@/lib/storage/presign';

/**
 * Allowed content types for post media uploads.
 */
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
];

/**
 * GET /api/upload/post-media
 *
 * Generate a presigned URL for uploading post media to B2.
 *
 * Query params:
 *   - contentType: MIME type of the file
 *
 * Returns:
 *   - upload_url: Presigned PUT URL for B2
 *   - key: The object key in the bucket
 *   - public_url: The public CDN URL for the uploaded file
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    // Check if B2 is configured
    if (!isB2Configured) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const contentType = searchParams.get('contentType');

    if (!contentType) {
      return NextResponse.json(
        { error: 'Missing required query parameter: contentType' },
        { status: 400 }
      );
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        {
          error: `Invalid content type "${contentType}". Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    try {
      const key = generateKey('posts', context.user.id, contentType);
      const uploadUrl = await getUploadUrl(key, contentType);
      const publicUrl = getPublicUrl(key);

      return NextResponse.json({
        upload_url: uploadUrl,
        key,
        public_url: publicUrl,
      });
    } catch (err) {
      console.error('[Post Media Upload] Error generating presigned URL:', err);
      return NextResponse.json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      );
    }
  }
);
