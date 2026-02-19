import { NextRequest, NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { BibleTranslation, DailyContent, DailyContentTranslation, LumaShortCreator, User } from '@/lib/db/models';

/**
 * GET /api/admin/content-production/preview-feed?month=YYYY-MM&mode=bible&language=en
 *
 * Returns all non-empty daily content for a given month in the same shape as
 * /api/daily-posts/feed — used by the Review Month admin tab to preview content
 * as end users would see it. No published filter, no date gating.
 */
export const GET = withAdmin(async (_req: NextRequest, _ctx: AuthContext) => {
  try {
    const url = new URL(_req.url);
    const month = url.searchParams.get('month');
    const mode = url.searchParams.get('mode') || 'bible';
    const language = url.searchParams.get('language') || 'en';

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month parameter (YYYY-MM)' }, { status: 400 });
    }

    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    const rows = await DailyContent.findAll({
      where: {
        post_date: { [Op.between]: [startDate, endDate] },
        mode,
        language,
      },
      include: [
        {
          model: DailyContentTranslation,
          as: 'translations',
          attributes: ['translation_code', 'translated_text', 'audio_url', 'audio_srt_url', 'chapter_text'],
        },
        {
          model: LumaShortCreator,
          as: 'creator',
          attributes: ['id', 'name'],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'avatar_url', 'avatar_color'],
            },
          ],
        },
      ],
      order: [['post_date', 'DESC']],
    });

    // Filter out empty days
    const nonEmpty = rows.filter((r) => r.status !== 'empty');

    // Batch-fetch BibleTranslation names
    const allCodes = new Set<string>();
    for (const row of nonEmpty) {
      const translations = row.get('translations') as DailyContentTranslation[] | undefined;
      if (translations) {
        for (const t of translations) {
          allCodes.add(t.translation_code);
        }
      }
    }

    const bibleTranslations = allCodes.size > 0
      ? await BibleTranslation.findAll({
          where: { code: Array.from(allCodes) },
          attributes: ['code', 'name'],
        })
      : [];
    const nameMap: Record<string, string> = {};
    for (const bt of bibleTranslations) {
      nameMap[bt.code] = bt.name;
    }

    // Format in the same shape as /api/daily-posts/feed
    const days = nonEmpty.map((content) => {
      const translations = (
        content.get('translations') as DailyContentTranslation[] | undefined
      )?.map((t) => ({
        code: t.translation_code,
        text: t.translated_text,
        audio_url: t.audio_url ?? null,
        audio_srt_url: t.audio_srt_url ?? null,
        chapter_text: t.chapter_text ?? null,
      })) ?? [];

      const translationNames: Record<string, string> = {};
      for (const t of translations) {
        if (nameMap[t.code]) translationNames[t.code] = nameMap[t.code];
      }

      const creatorRaw = content.get('creator') as Record<string, unknown> | null;
      const creator = creatorRaw
        ? {
            name: creatorRaw.name as string,
            avatar_url: (creatorRaw as Record<string, unknown> & { user?: { avatar_url?: string | null } })?.user?.avatar_url ?? null,
            avatar_color: (creatorRaw as Record<string, unknown> & { user?: { avatar_color?: string } })?.user?.avatar_color ?? '#6366f1',
          }
        : null;

      return {
        id: content.id,
        post_date: content.post_date,
        mode: content.mode,
        language: content.language,
        title: content.title,
        content_text: content.content_text,
        verse_reference: content.verse_reference,
        chapter_reference: content.chapter_reference,
        video_background_url: content.video_background_url,
        lumashort_video_url: content.lumashort_video_url,
        translations,
        translation_names: translationNames,
        creator,
      };
    });

    return NextResponse.json({ days });
  } catch (error) {
    console.error('[Server Error] Failed to fetch preview feed:', error);
    return NextResponse.json({ error: 'Failed to fetch preview feed' }, { status: 500 });
  }
});
