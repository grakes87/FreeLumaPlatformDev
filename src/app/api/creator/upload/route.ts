import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { withCreator, type CreatorContext } from '@/lib/auth/middleware';
import { b2Client, B2_BUCKET, isB2Configured } from '@/lib/storage/b2';
import { getPublicUrl } from '@/lib/storage/presign';
import { compressVideo } from '@/lib/video/compress';

/**
 * POST /api/creator/upload
 * Called AFTER the client has uploaded the raw video directly to B2
 * via a presigned URL. This route just updates the DB record and
 * kicks off background compression.
 *
 * Body (JSON):
 *   - daily_content_id: number
 *   - key: string (the B2 object key from the presigned upload)
 */
export const POST = withCreator(async (req: NextRequest, context: CreatorContext) => {
  if (!isB2Configured || !b2Client) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  const { DailyContent } = await import('@/lib/db/models');

  let body: { daily_content_id?: number; key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { daily_content_id, key } = body;

  if (!daily_content_id || !key) {
    return NextResponse.json(
      { error: 'daily_content_id and key are required' },
      { status: 400 }
    );
  }

  // Validate the key belongs to creator-videos and this user
  // (presigned URL uses user.id, not creator.id)
  if (!key.startsWith(`creator-videos/${context.user.id}/`)) {
    return NextResponse.json(
      { error: 'Invalid upload key' },
      { status: 403 }
    );
  }

  const contentId = Number(daily_content_id);
  if (isNaN(contentId)) {
    return NextResponse.json({ error: 'Invalid daily_content_id' }, { status: 400 });
  }

  // Validate content ownership and status
  const content = await DailyContent.findByPk(contentId);

  if (!content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  }

  if (content.creator_id !== context.creator.id) {
    return NextResponse.json(
      { error: 'You are not assigned to this content' },
      { status: 403 }
    );
  }

  if (content.status === 'approved') {
    return NextResponse.json(
      { error: 'Content already approved. Cannot re-submit.' },
      { status: 400 }
    );
  }
  if (content.status !== 'assigned' && content.status !== 'rejected' && content.status !== 'submitted') {
    return NextResponse.json(
      { error: `Cannot submit video when status is '${content.status}'` },
      { status: 400 }
    );
  }

  const rawUrl = getPublicUrl(key);

  // Update content: set raw URL as both playable and fallback, mark submitted
  await content.update({
    lumashort_video_url: rawUrl,
    creator_video_url: rawUrl,
    creator_video_thumbnail: null,
    status: 'submitted',
    rejection_note: null,
  });

  console.log(`[creator/upload] Content ${contentId} submitted with raw video: ${key}`);

  // Respond immediately — DB is updated
  const response = NextResponse.json({
    content: {
      id: content.id,
      post_date: content.post_date,
      status: 'submitted',
      lumashort_video_url: rawUrl,
    },
  });

  // Fire-and-forget: compress in background, then replace URL
  compressAndReplace(contentId, key).catch(() => {
    // Errors already logged inside compressAndReplace
  });

  return response;
});

/**
 * Background compression: download raw from B2, compress, re-upload compressed,
 * update DB. If anything fails, the raw video remains as a working fallback.
 */
async function compressAndReplace(
  contentId: number,
  rawKey: string
): Promise<void> {
  const { DailyContent } = await import('@/lib/db/models');
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');

  try {
    console.log(`[creator/upload] Starting background compression for content ${contentId}`);

    // Download raw video from B2
    const getResult = await b2Client!.send(
      new GetObjectCommand({ Bucket: B2_BUCKET, Key: rawKey })
    );
    const chunks: Buffer[] = [];
    const stream = getResult.Body as NodeJS.ReadableStream;
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const inputBuffer = Buffer.concat(chunks);

    const rawSizeMB = (inputBuffer.byteLength / 1024 / 1024).toFixed(1);
    console.log(`[creator/upload] Downloaded raw video: ${rawSizeMB} MB`);

    // Compress with FFmpeg (720p portrait H.264 MP4)
    const compressedBuffer = await compressVideo(inputBuffer);

    const compressedSizeMB = (compressedBuffer.byteLength / 1024 / 1024).toFixed(1);
    console.log(`[creator/upload] Compressed ${rawSizeMB} MB → ${compressedSizeMB} MB`);

    // Upload compressed MP4 to B2
    const random = Math.random().toString(36).slice(2, 8);
    const compressedKey = rawKey
      .replace(/\/raw-/, '/')
      .replace(/\.\w+$/, `-${random}.mp4`);

    await b2Client!.send(
      new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: compressedKey,
        Body: compressedBuffer,
        ContentType: 'video/mp4',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const compressedUrl = getPublicUrl(compressedKey);

    // Update lumashort_video_url to compressed version; keep creator_video_url as raw fallback
    const content = await DailyContent.findByPk(contentId);
    if (content) {
      await content.update({ lumashort_video_url: compressedUrl });
      console.log(`[creator/upload] Compression complete for content ${contentId}: ${compressedKey}`);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[creator/upload] Background compression failed for content ${contentId}: ${detail}`);
    // Raw video remains at lumashort_video_url — still playable
  }
}
