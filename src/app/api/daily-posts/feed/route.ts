import { NextRequest, NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { BibleTranslation, DailyContent, DailyContentTranslation, LumaShortCreator, User } from '@/lib/db/models';

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

      // Extract creator info if assigned
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

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].post_date
      : null;

    // Only edge-cache responses that contain data; empty results should not be
    // cached so that newly-published content is picked up immediately.
    const cacheHeader = days.length > 0
      ? 'public, s-maxage=1209600, stale-while-revalidate=86400'
      : 'no-store';

    return NextResponse.json(
      { days, next_cursor: nextCursor, has_more: hasMore },
      {
        headers: { 'Cache-Control': cacheHeader },
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
