import { NextRequest, NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { withCreator, type CreatorContext } from '@/lib/auth/middleware';

/**
 * GET /api/creator/assignments
 * Returns the authenticated creator's assigned content for a given month.
 * Query: ?month=YYYY-MM (optional, defaults to current month)
 */
export const GET = withCreator(async (req: NextRequest, context: CreatorContext) => {
  const { DailyContent, DailyContentTranslation } = await import('@/lib/db/models');

  const url = new URL(req.url);
  const monthParam = url.searchParams.get('month');

  let year: number;
  let month: number;

  if (monthParam) {
    const match = monthParam.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM.' },
        { status: 400 }
      );
    }
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10);
    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid month value.' },
        { status: 400 }
      );
    }
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  // Build date range for the month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const assignments = await DailyContent.findAll({
    where: {
      creator_id: context.creator.id,
      post_date: {
        [Op.between]: [startDate, endDate],
      },
    },
    include: [
      {
        model: DailyContentTranslation,
        as: 'translations',
        attributes: ['translation_code', 'audio_url', 'audio_srt_url'],
      },
    ],
    order: [['post_date', 'ASC']],
  });

  const result = assignments.map((a) => {
    const plain = a.get({ plain: true });
    const raw = plain as typeof plain & {
      translations?: Array<{
        audio_url: string | null;
        audio_srt_url: string | null;
      }>;
    };

    return {
      id: raw.id,
      post_date: raw.post_date,
      mode: raw.mode,
      status: raw.status,
      title: raw.title,
      verse_reference: raw.verse_reference,
      has_camera_script: !!raw.camera_script,
      has_creator_video: !!raw.creator_video_url,
      has_audio: raw.translations?.some((t) => !!t.audio_url) ?? false,
      has_srt: raw.translations?.some((t) => !!t.audio_srt_url) ?? false,
    };
  });

  return NextResponse.json({ assignments: result });
});
