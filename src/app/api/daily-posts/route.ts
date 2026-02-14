import { NextRequest } from 'next/server';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { BibleTranslation, DailyContent, DailyContentTranslation, User } from '@/lib/db/models';
import { getUserLocalDate } from '@/lib/utils/timezone';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { LANGUAGES } from '@/lib/utils/constants';

/**
 * GET /api/daily-posts
 *
 * Returns today's daily content. If authenticated, uses user's timezone,
 * mode, and language. If guest (unauthenticated), defaults to bible/en/UTC.
 */
export const GET = withOptionalAuth(async (req: NextRequest, context: OptionalAuthContext) => {
  try {
    let mode = 'bible';
    let language = 'en';
    let timezone = 'UTC';

    // If authenticated, load user preferences
    if (context.user) {
      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'mode', 'timezone', 'language', 'preferred_translation'],
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

    // Calculate "today" in the user's (or default) timezone
    const today = getUserLocalDate(timezone);

    // Query daily content
    const content = await DailyContent.findOne({
      where: {
        post_date: today,
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
    });

    if (!content) {
      return errorResponse(
        `No content available for ${today}. Check back soon!`,
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
      audio_url: content.audio_url,
      audio_srt_url: content.audio_srt_url,
      lumashort_video_url: content.lumashort_video_url,
      translations,
      translation_names: translationNames,
    };

    // Fire-and-forget: track daily view for authenticated users
    if (context.user) {
      import('@/lib/streaks/tracker').then(({ trackActivity }) => {
        trackActivity(context.user!.id, 'daily_view', timezone).catch(() => {});
      }).catch(() => {});
    }

    return successResponse(response);
  } catch (error) {
    return serverError(error, 'Failed to fetch daily content');
  }
});
