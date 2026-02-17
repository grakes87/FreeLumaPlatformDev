import { NextRequest } from 'next/server';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { BibleTranslation, DailyContent, DailyContentTranslation, User } from '@/lib/db/models';
import { getUserLocalDate, isValidDateString, isFutureDate } from '@/lib/utils/timezone';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { LANGUAGES } from '@/lib/utils/constants';

/**
 * GET /api/daily-posts/[date]
 *
 * Returns daily content for a specific date (YYYY-MM-DD format).
 * If authenticated, uses user preferences. If guest, defaults to bible/en/UTC.
 */
export const GET = withOptionalAuth(async (req: NextRequest, context: OptionalAuthContext) => {
  try {
    const params = await context.params;
    const date = params.date;

    // Validate date format
    if (!date || !isValidDateString(date)) {
      return errorResponse(
        'Invalid date format. Use YYYY-MM-DD (e.g., 2026-02-11).',
        400
      );
    }

    let mode = 'bible';
    let language = 'en';
    let timezone = 'UTC';

    // If authenticated, load user preferences
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

    // For guests, check language cookie
    if (!context.user) {
      const langCookie = req.cookies.get('preferred_language')?.value;
      if (langCookie && (LANGUAGES as readonly string[]).includes(langCookie)) {
        language = langCookie;
      }
    }

    // Allow timezone override via query param
    const url = new URL(req.url);
    const timezoneParam = url.searchParams.get('timezone');
    if (timezoneParam) {
      timezone = timezoneParam;
    }

    // Reject future dates
    if (isFutureDate(date, timezone)) {
      return errorResponse('Cannot view future content.', 400);
    }

    // Query daily content for the specified date
    const content = await DailyContent.findOne({
      where: {
        post_date: date,
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
    });

    if (!content) {
      return errorResponse(
        `No content available for ${date}.`,
        404
      );
    }

    // Build translation name lookup from DB
    const translations = (
      content.get('translations') as DailyContentTranslation[] | undefined
    )?.map((t) => ({
      code: t.translation_code,
      text: t.translated_text,
      audio_url: t.audio_url ?? null,
      audio_srt_url: t.audio_srt_url ?? null,
      chapter_text: t.chapter_text ?? null,
    })) ?? [];

    const codes = translations.map((t) => t.code);
    const bibleTranslations = codes.length > 0
      ? await BibleTranslation.findAll({
          where: { code: codes },
          attributes: ['code', 'name'],
        })
      : [];
    const translationNames: Record<string, string> = {};
    for (const bt of bibleTranslations) {
      translationNames[bt.code] = bt.name;
    }

    // Format the response
    const today = getUserLocalDate(timezone);
    const response = {
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
      is_today: content.post_date === today,
      translations,
      translation_names: translationNames,
    };

    return successResponse(response);
  } catch (error) {
    return serverError(error, 'Failed to fetch daily content');
  }
});
