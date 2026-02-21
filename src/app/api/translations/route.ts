import { NextRequest } from 'next/server';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { DailyContent, DailyContentTranslation } from '@/lib/db/models';
import { fetchVerseFromBibleApi } from '@/lib/bible-api';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/translations?daily_content_id=1&translation_code=KJV
 *
 * Returns the text for a specific Bible translation of a daily content post.
 *
 * Flow:
 * 1. Check DailyContentTranslation table for existing translation
 * 2. If not found AND mode is 'bible': Attempt fetchVerseFromBibleApi()
 * 3. If bible.api returns text: Save to DB (source='api'), return text
 * 4. If bible.api fails: Return 404
 * 5. For positivity mode: Return 400 (translations don't apply to quotes)
 */
export const GET = withOptionalAuth(async (req: NextRequest, context: OptionalAuthContext) => {
  try {
    const url = new URL(req.url);
    const dailyContentIdStr = url.searchParams.get('daily_content_id');
    const translationCode = url.searchParams.get('translation_code');

    // Validate required parameters
    if (!dailyContentIdStr || !translationCode) {
      return errorResponse(
        'Missing required parameters: daily_content_id and translation_code',
        400
      );
    }

    const dailyContentId = parseInt(dailyContentIdStr, 10);
    if (isNaN(dailyContentId) || dailyContentId < 1) {
      return errorResponse('Invalid daily_content_id', 400);
    }

    const code = translationCode.toUpperCase().trim();
    if (!code || code.length > 10) {
      return errorResponse('Invalid translation_code', 400);
    }

    // Fetch the parent DailyContent record
    const dailyContent = await DailyContent.findByPk(dailyContentId, {
      attributes: ['id', 'mode', 'verse_reference', 'content_text'],
    });

    if (!dailyContent) {
      return errorResponse('Daily content not found', 404);
    }

    // Positivity mode doesn't use Bible translations
    if (dailyContent.mode === 'positivity') {
      return errorResponse(
        'Translation switching is not available for positivity content. Quotes are language-based, not translation-based.',
        400
      );
    }

    // Step 1: Check DB for existing translation
    const existingTranslation = await DailyContentTranslation.findOne({
      where: {
        daily_content_id: dailyContentId,
        translation_code: code,
      },
    });

    if (existingTranslation) {
      return successResponse({
        daily_content_id: dailyContentId,
        translation_code: code,
        text: existingTranslation.translated_text,
        audio_url: existingTranslation.audio_url ?? null,
        audio_srt_url: existingTranslation.audio_srt_url ?? null,
        chapter_text: existingTranslation.chapter_text ?? null,
        source: existingTranslation.source,
      }, 200, {
        'Cache-Control': 'public, s-maxage=1209600, stale-while-revalidate=86400',
      });
    }

    // Step 2: Translation not in DB -- try bible.api fallback
    if (!dailyContent.verse_reference) {
      return errorResponse(
        `Translation "${code}" is not available for this content.`,
        404
      );
    }

    const apiText = await fetchVerseFromBibleApi(
      dailyContentId,
      dailyContent.verse_reference,
      code
    );

    if (apiText) {
      // fetchVerseFromBibleApi already cached the translation to DB
      return successResponse({
        daily_content_id: dailyContentId,
        translation_code: code,
        text: apiText,
        source: 'api',
      }, 200, {
        'Cache-Control': 'public, s-maxage=1209600, stale-while-revalidate=86400',
      });
    }

    // Step 3: API fallback also failed
    return errorResponse(
      `Translation "${code}" is not available. It may not be supported by our Bible translation provider.`,
      404
    );
  } catch (error) {
    return serverError(error, 'Failed to fetch translation');
  }
});
