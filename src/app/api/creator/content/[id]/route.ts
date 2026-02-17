import { NextRequest, NextResponse } from 'next/server';
import { withCreator, type CreatorContext } from '@/lib/auth/middleware';

/**
 * GET /api/creator/content/[id]
 * Returns full content details for an assigned day.
 * Only the assigned creator can view the content.
 */
export const GET = withCreator(async (_req: NextRequest, context: CreatorContext) => {
  const { DailyContent, DailyContentTranslation } = await import('@/lib/db/models');

  const params = await context.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid content ID' }, { status: 400 });
  }

  const content = await DailyContent.findByPk(id, {
    include: [
      {
        model: DailyContentTranslation,
        as: 'translations',
      },
    ],
  });

  if (!content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  }

  if (content.creator_id !== context.creator.id) {
    return NextResponse.json(
      { error: 'You are not assigned to this content' },
      { status: 403 }
    );
  }

  return NextResponse.json({ content });
});
