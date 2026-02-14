import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { BibleTranslation, DailyContent, DailyContentTranslation, User } from '@/lib/db/models';
import { getUserLocalDate } from '@/lib/utils/timezone';
import { successResponse, serverError } from '@/lib/utils/api';
import { LANGUAGES } from '@/lib/utils/constants';

/**
 * GET /api/daily-posts/feed?cursor=YYYY-MM-DD&limit=5&timezone=...
 *
 * Returns a paginated list of daily content for vertical scroll feed.
 * Ordered by post_date DESC (today first, older days below).
 */
export const GET = withOptionalAuth(async (req: NextRequest, context: OptionalAuthContext) => {
  try {
    let mode = 'bible';
    let language = 'en';
    let timezone = 'UTC';

    if (context.user) {
      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'mode', 'timezone', 'language'],
      });
      if (user) {
        mode = user.mode;
        language = user.language;
        timezone = user.timezone;
      }
    }

    // Guest language from cookie
    if (!context.user) {
      const langCookie = req.cookies.get('preferred_language')?.value;
      if (langCookie && (LANGUAGES as readonly string[]).includes(langCookie)) {
        language = langCookie;
      }
    }

    const url = new URL(req.url);
    const timezoneParam = url.searchParams.get('timezone');
    if (timezoneParam) timezone = timezoneParam;

    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '5', 10), 1), 20);

    const today = getUserLocalDate(timezone);

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
          attributes: ['translation_code', 'translated_text', 'audio_url', 'audio_srt_url'],
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
        audio_url: content.audio_url,
        audio_srt_url: content.audio_srt_url,
        lumashort_video_url: content.lumashort_video_url,
        translations,
        translation_names: translationNames,
      };
    });

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].post_date
      : null;

    return successResponse({
      days,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch daily feed');
  }
});
