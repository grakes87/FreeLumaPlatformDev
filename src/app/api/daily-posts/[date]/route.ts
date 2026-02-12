import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { DailyContent, DailyContentTranslation, User } from '@/lib/db/models';
import { getUserLocalDate, isValidDateString, isFutureDate } from '@/lib/utils/timezone';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/daily-posts/[date]
 *
 * Returns daily content for a specific date (YYYY-MM-DD format).
 * Validates date format, rejects future dates, and respects user's mode/language.
 */
export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
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

    // Fetch user for mode, timezone, language
    const user = await User.findByPk(context.user.id, {
      attributes: ['id', 'mode', 'timezone', 'language'],
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Allow timezone override via query param
    const url = new URL(req.url);
    const timezone = url.searchParams.get('timezone') || user.timezone;

    // Reject future dates
    if (isFutureDate(date, timezone)) {
      return errorResponse('Cannot view future content.', 400);
    }

    // Query daily content for the specified date
    const content = await DailyContent.findOne({
      where: {
        post_date: date,
        mode: user.mode,
        language: user.language,
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
        `No content available for ${date}.`,
        404
      );
    }

    // Format the response
    const today = getUserLocalDate(timezone);
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
      is_today: content.post_date === today,
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
