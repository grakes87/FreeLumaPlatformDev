import { NextRequest, NextResponse } from 'next/server';
import { withCreator, type CreatorContext } from '@/lib/auth/middleware';

/**
 * POST /api/creator/upload
 * Submit a recorded video for an assigned content day.
 * Body: { daily_content_id, video_url, thumbnail_url }
 */
export const POST = withCreator(async (req: NextRequest, context: CreatorContext) => {
  const { DailyContent } = await import('@/lib/db/models');

  let body: { daily_content_id?: number; video_url?: string; thumbnail_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { daily_content_id, video_url, thumbnail_url } = body;

  if (!daily_content_id || !video_url) {
    return NextResponse.json(
      { error: 'daily_content_id and video_url are required' },
      { status: 400 }
    );
  }

  const content = await DailyContent.findByPk(daily_content_id);

  if (!content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  }

  if (content.creator_id !== context.creator.id) {
    return NextResponse.json(
      { error: 'You are not assigned to this content' },
      { status: 403 }
    );
  }

  // Only allow submission when assigned or rejected (re-record after rejection)
  if (content.status === 'submitted') {
    return NextResponse.json(
      { error: 'Video already submitted. Wait for review.' },
      { status: 400 }
    );
  }
  if (content.status === 'approved') {
    return NextResponse.json(
      { error: 'Content already approved. Cannot re-submit.' },
      { status: 400 }
    );
  }
  if (content.status !== 'assigned' && content.status !== 'rejected') {
    return NextResponse.json(
      { error: `Cannot submit video when status is '${content.status}'` },
      { status: 400 }
    );
  }

  await content.update({
    creator_video_url: video_url,
    creator_video_thumbnail: thumbnail_url || null,
    status: 'submitted',
    rejection_note: null,
  });

  return NextResponse.json({
    content: {
      id: content.id,
      post_date: content.post_date,
      status: content.status,
      creator_video_url: content.creator_video_url,
      creator_video_thumbnail: content.creator_video_thumbnail,
    },
  });
});
