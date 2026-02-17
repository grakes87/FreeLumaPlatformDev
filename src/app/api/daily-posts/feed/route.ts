import { NextRequest, NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { BibleTranslation, DailyContent, DailyContentTranslation } from '@/lib/db/models';

/**
 * GET /api/daily-posts/feed?mode=bible&language=en&date=2026-02-17&cursor=YYYY-MM-DD&limit=5
 *
 * Returns a paginated list of daily content for vertical scroll feed.
 * Ordered by post_date DESC (today first, older days below).
 *
 * Edge-cacheable: response varies only by query params (mode, language, date, cursor, limit).
 * Cloudflare caches at the edge for 14 days — one DB query per unique param combo.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') || 'bible';
    const language = url.searchParams.get('language') || 'en';
    const today = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '5', 10), 1), 20);

    // Build date filter: post_date <= today (or < cursor for pagination)
    const dateFilter = cursor
      ? { [Op.lt]: cursor }
      : { [Op.lte]: today };

    const rows = await DailyContent.findAll({
      where: {
        post_date: dateFilter,
        mode,
        language,
        published: true,
      },
      include: [
        {
          model: DailyContentTranslation,
          as: 'translations',
          attributes: ['translation_code', 'translated_text', 'audio_url', 'audio_srt_url', 'chapter_text'],
        },
      ],
      order: [['post_date', 'DESC']],
      limit: limit + 1, // Fetch one extra to detect has_more
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    // Batch-fetch all BibleTranslation names across all days
    const allCodes = new Set<string>();
    for (const row of items) {
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

    // Format each day
    const days = items.map((content) => {
      const translations = (
        content.get('translations') as DailyContentTranslation[] | undefined
      )?.map((t) => ({
        code: t.translation_code,
        text: t.translated_text,
        audio_url: t.audio_url ?? null,
        audio_srt_url: t.audio_srt_url ?? null,
        chapter_text: t.chapter_text ?? null,
      })) ?? [];

      // Filter name map to only codes in this day
      const translationNames: Record<string, string> = {};
      for (const t of translations) {
        if (nameMap[t.code]) translationNames[t.code] = nameMap[t.code];
      }

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
      };
    });

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].post_date
      : null;

    return NextResponse.json(
      { days, next_cursor: nextCursor, has_more: hasMore },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1209600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('[Server Error] Failed to fetch daily feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily feed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
