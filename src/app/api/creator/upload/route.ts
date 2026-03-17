import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { withCreator, type CreatorContext } from '@/lib/auth/middleware';
import { b2Client, B2_BUCKET, isB2Configured } from '@/lib/storage/b2';
import { getPublicUrl } from '@/lib/storage/presign';
import { compressVideo } from '@/lib/video/compress';

// Allow large video uploads (up to 200 MB)
export const maxDuration = 120; // 2 min — raw upload only, no compression wait

/**
 * POST /api/creator/upload
 * Accept a recorded video file, upload the RAW video to B2 immediately,
 * respond to the client, then compress in the background.
 *
 * Body: FormData with fields:
 *   - video: File (the recorded video blob)
 *   - daily_content_id: string (the content ID to attach the video to)
 */
export const POST = withCreator(async (req: NextRequest, context: CreatorContext) => {
  if (!isB2Configured || !b2Client) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  const { DailyContent } = await import('@/lib/db/models');

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const videoFile = formData.get('video');
  const dailyContentId = formData.get('daily_content_id');

  if (!(videoFile instanceof File) || !dailyContentId) {
    return NextResponse.json(
      { error: 'video file and daily_content_id are required' },
      { status: 400 }
    );
  }

  const contentId = parseInt(String(dailyContentId), 10);
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

  // Read file into buffer
  let inputBuffer: Buffer;
  try {
    const arrayBuffer = await videoFile.arrayBuffer();
    inputBuffer = Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('[creator/upload] Failed to read uploaded file:', err);
    return NextResponse.json(
      { error: 'Failed to read uploaded video file.' },
      { status: 400 }
    );
  }

  if (inputBuffer.byteLength === 0) {
    return NextResponse.json(
      { error: 'Uploaded video file is empty.' },
      { status: 400 }
    );
  }

  const sizeMB = (inputBuffer.byteLength / 1024 / 1024).toFixed(1);
  console.log(`[creator/upload] Received ${sizeMB} MB video, type: ${videoFile.type}`);

  // Upload RAW video to B2 immediately
  const ext = (videoFile.type || '').includes('mp4') ? 'mp4' : 'webm';
  const random = Math.random().toString(36).slice(2, 8);
  const rawKey = `creator-videos/${context.creator.id}/raw-${Date.now()}-${random}.${ext}`;

  try {
    await b2Client.send(
      new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: rawKey,
        Body: inputBuffer,
        ContentType: videoFile.type || 'video/webm',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  } catch (err) {
    console.error('[creator/upload] B2 raw upload failed:', err);
    return NextResponse.json(
      { error: 'Failed to upload video. Please try again.' },
      { status: 500 }
    );
  }

  const rawUrl = getPublicUrl(rawKey);
  console.log(`[creator/upload] Raw video uploaded: ${rawKey}`);

  // Update content: set raw URL as both playable and fallback, mark submitted
  await content.update({
    lumashort_video_url: rawUrl,
    creator_video_url: rawUrl,
    creator_video_thumbnail: null,
    status: 'submitted',
    rejection_note: null,
  });

  // Respond immediately — upload is done
  const response = NextResponse.json({
    content: {
      id: content.id,
      post_date: content.post_date,
      status: 'submitted',
      lumashort_video_url: rawUrl,
    },
  });

  // Fire-and-forget: compress in background, then replace URL
  compressAndReplace(contentId, rawKey, inputBuffer).catch(() => {
    // Errors already logged inside compressAndReplace
  });

  return response;
});

/**
 * Background compression: compress the raw video and replace the URL.
 * If anything fails, the raw video remains as a working fallback.
 */
async function compressAndReplace(
  contentId: number,
  rawKey: string,
  inputBuffer: Buffer
): Promise<void> {
  const { DailyContent } = await import('@/lib/db/models');

  try {
    console.log(`[creator/upload] Starting background compression for content ${contentId}`);

    // Compress with FFmpeg (720p portrait H.264 MP4)
    const compressedBuffer = await compressVideo(inputBuffer);

    const compressedSizeMB = (compressedBuffer.byteLength / 1024 / 1024).toFixed(1);
    const rawSizeMB = (inputBuffer.byteLength / 1024 / 1024).toFixed(1);
    console.log(`[creator/upload] Compressed ${rawSizeMB} MB → ${compressedSizeMB} MB`);

    // Upload compressed MP4 to B2
    const random = Math.random().toString(36).slice(2, 8);
    const compressedKey = rawKey
      .replace(/^(creator-videos\/\d+\/)raw-/, `$1`)
      .replace(/\.\w+$/, `.mp4`);
    const finalKey = compressedKey.replace(/\.mp4$/, `-${random}.mp4`);

    await b2Client!.send(
      new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: finalKey,
        Body: compressedBuffer,
        ContentType: 'video/mp4',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const compressedUrl = getPublicUrl(finalKey);

    // Update lumashort_video_url to compressed version; keep creator_video_url as raw fallback
    const content = await DailyContent.findByPk(contentId);
    if (content) {
      await content.update({ lumashort_video_url: compressedUrl });
      console.log(`[creator/upload] Compression complete for content ${contentId}: ${finalKey}`);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[creator/upload] Background compression failed for content ${contentId}: ${detail}`);
    // Raw video remains at lumashort_video_url — still playable
  }
}
