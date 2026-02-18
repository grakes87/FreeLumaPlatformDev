import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { withCreator, type CreatorContext } from '@/lib/auth/middleware';
import { b2Client, B2_BUCKET, isB2Configured } from '@/lib/storage/b2';
import { getPublicUrl, generateKey } from '@/lib/storage/presign';
import { compressVideo } from '@/lib/video/compress';

// Allow large video uploads (up to 200 MB)
export const maxDuration = 300; // 5 min timeout for compression

/**
 * POST /api/creator/upload
 * Accept a recorded video file, compress it server-side with FFmpeg,
 * upload the compressed MP4 to B2, and update the daily_content record.
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

  console.log(`[creator/upload] Received ${(inputBuffer.byteLength / 1024 / 1024).toFixed(1)} MB video, type: ${videoFile.type}`);

  // Compress with FFmpeg (720p portrait H.264 MP4)
  let compressedBuffer: Buffer;
  try {
    compressedBuffer = await compressVideo(inputBuffer);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[creator/upload] Compression failed:', detail);
    return NextResponse.json(
      { error: `Video compression failed: ${detail}` },
      { status: 500 }
    );
  }

  // Upload compressed file to B2
  const key = generateKey('creator-videos', context.creator.id, 'video/mp4');

  try {
    await b2Client.send(
      new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: key,
        Body: compressedBuffer,
        ContentType: 'video/mp4',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  } catch (err) {
    console.error('[creator/upload] B2 upload failed:', err);
    return NextResponse.json(
      { error: 'Failed to upload video. Please try again.' },
      { status: 500 }
    );
  }

  const publicUrl = getPublicUrl(key);

  // Update content record
  await content.update({
    lumashort_video_url: publicUrl,
    creator_video_thumbnail: null,
    status: 'submitted',
    rejection_note: null,
  });

  return NextResponse.json({
    content: {
      id: content.id,
      post_date: content.post_date,
      status: content.status,
      lumashort_video_url: content.lumashort_video_url,
    },
  });
});
