import { NextRequest } from 'next/server';
import { fetchPassage } from '@/lib/bible-api';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/bible-translations/verse?reference=John+3:16&translation=ESV&type=verse
 *
 * Fetches a Bible verse or chapter in the requested translation.
 *
 * Query params:
 *   reference  - Human-readable reference (e.g., "John 3:16", "Psalm 23")
 *   translation - Translation code (e.g., "ESV", "NIV", "KJV")
 *   type       - "verse" (default) or "chapter"
 *
 * Routing:
 *   ESV → api.esv.org (Token auth)
 *   All others → API.Bible (api-key auth)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');
    const translation = url.searchParams.get('translation');
    const type = (url.searchParams.get('type') || 'verse') as 'verse' | 'chapter';

    if (!reference) {
      return errorResponse('Missing required parameter: reference', 400);
    }

    if (!translation) {
      return errorResponse('Missing required parameter: translation', 400);
    }

    if (type !== 'verse' && type !== 'chapter') {
      return errorResponse('Invalid type parameter. Must be "verse" or "chapter".', 400);
    }

    const code = translation.toUpperCase().trim();
    if (!code || code.length > 10) {
      return errorResponse('Invalid translation code', 400);
    }

    const text = await fetchPassage(reference, code, type);

    if (!text) {
      return errorResponse(
        `Could not fetch ${type} "${reference}" in ${code}. The translation or reference may not be available.`,
        404
      );
    }

    return successResponse({
      reference,
      translation: code,
      type,
      text,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch Bible passage');
  }
}
