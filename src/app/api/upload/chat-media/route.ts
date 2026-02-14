import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { isB2Configured, b2Client, B2_BUCKET } from '@/lib/storage/b2';
import { getUploadUrl, getPublicUrl, generateKey } from '@/lib/storage/presign';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Allowed MIME types for chat media: images, videos, and voice messages.
 */
function isAllowedChatMediaType(mimeType: string): boolean {
  // Strip codec params (e.g. "audio/webm;codecs=opus" → "audio/webm")
  const base = mimeType.split(';')[0].trim();
  return (
    base.startsWith('image/') ||
    base.startsWith('video/') ||
    base === 'audio/mpeg' ||
    base === 'audio/wav' ||
    base === 'audio/ogg' ||
    base === 'audio/webm' ||
    base === 'audio/mp4' ||
    base === 'audio/aac'
  );
}

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

/**
 * GET /api/upload/chat-media
 * Generate a presigned URL for uploading chat media to B2.
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

    if (!isAllowedChatMediaType(contentType)) {
      return NextResponse.json(
        {
          error: `Invalid content type "${contentType}". Must be an image, video, or audio type.`,
        },
        { status: 400 }
      );
    }

    try {
      const key = generateKey('chat', context.user.id, contentType);
      const uploadUrl = await getUploadUrl(key, contentType);
      const publicUrl = getPublicUrl(key);

      return NextResponse.json({
        upload_url: uploadUrl,
        key,
        public_url: publicUrl,
      });
    } catch (err) {
      console.error('[Chat Media Upload] Error generating presigned URL:', err);
      return NextResponse.json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      );
    }
  }
);

/**
 * POST /api/upload/chat-media
 * Server-side upload: accepts file via FormData and uploads to B2 directly.
 *
 * FormData fields:
 *   - file: The file to upload
 *
 * Returns:
 *   - key: The object key in the bucket
 *   - public_url: The public CDN URL for the uploaded file
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    if (!isB2Configured || !b2Client) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 }
      );
    }

    try {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      if (!isAllowedChatMediaType(file.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type "${file.type}". Must be an image, video, or audio type.`,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'File too large (max 200 MB)' },
          { status: 400 }
        );
      }

      const key = generateKey('chat', context.user.id, file.type);
      const buffer = Buffer.from(await file.arrayBuffer());

      await b2Client.send(
        new PutObjectCommand({
          Bucket: B2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        })
      );

      const publicUrl = getPublicUrl(key);

      return NextResponse.json({ key, public_url: publicUrl }, { status: 201 });
    } catch (err) {
      console.error('[Chat Media Upload] Server upload error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      const name = err instanceof Error ? err.name : 'UnknownError';
      const metadata = (err as Record<string, unknown>)?.$metadata as Record<string, unknown> | undefined;
      return NextResponse.json(
        {
          error: 'Failed to upload file',
          detail: `${name}: ${message}`,
          httpStatus: metadata?.httpStatusCode ?? null,
        },
        { status: 500 }
      );
    }
  }
);
