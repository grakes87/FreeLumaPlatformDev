import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { DailyContent, DailyContentTranslation, User } from '@/lib/db/models';
import { getUserLocalDate } from '@/lib/utils/timezone';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/daily-posts
 *
 * Returns today's daily content for the authenticated user based on their
 * timezone, mode (bible/positivity), and language preference.
 *
 * The "today" calculation is timezone-aware: content changes at the user's
 * local midnight, not server midnight.
 */
export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    // Fetch the user's full profile for mode, timezone, and language
    const user = await User.findByPk(context.user.id, {
      attributes: ['id', 'mode', 'timezone', 'language', 'preferred_translation'],
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Allow timezone override via query param (for clients sending their detected timezone)
    const url = new URL(req.url);
    const timezone = url.searchParams.get('timezone') || user.timezone;

    // Calculate "today" in the user's timezone
    const today = getUserLocalDate(timezone);

    // Query daily content for today, the user's mode, and language
    const content = await DailyContent.findOne({
      where: {
        post_date: today,
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
