import { NextRequest } from 'next/server';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { DailyContent, DailyContentTranslation, User } from '@/lib/db/models';
import { getUserLocalDate } from '@/lib/utils/timezone';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

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
          attributes: ['translation_code', 'translated_text'],
        },
      ],
    });

    if (!content) {
      return errorResponse(
        `No content available for ${today}. Check back soon!`,
        404
      );
    }

    // Format the response
    const response = {
      id: content.id,
      post_date: content.post_date,
      mode: content.mode,
      title: content.title,
      content_text: content.content_text,
      verse_reference: content.verse_reference,
      chapter_reference: content.chapter_reference,
      video_background_url: content.video_background_url,
      audio_url: content.audio_url,
      audio_srt_url: content.audio_srt_url,
      lumashort_video_url: content.lumashort_video_url,
      translations: (
        content.get('translations') as DailyContentTranslation[] | undefined
      )?.map((t) => ({
        code: t.translation_code,
        text: t.translated_text,
      })) ?? [],
    };

    return successResponse(response);
  } catch (error) {
    return serverError(error, 'Failed to fetch daily content');
  }
});
