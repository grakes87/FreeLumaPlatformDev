import { BibleTranslation, DailyContentTranslation } from '@/lib/db/models';
import { fetchFromEsvApi } from './esv';

export { fetchFromEsvApi } from './esv';

/**
 * Cache of translation code -> API.Bible Bible ID, loaded from bible_translations table.
 */
let _bibleApiIds: Record<string, string> | null = null;

async function getBibleApiIds(): Promise<Record<string, string>> {
  if (_bibleApiIds) return _bibleApiIds;
  try {
    const translations = await BibleTranslation.findAll({
      where: { active: true },
      attributes: ['code', 'api_bible_id'],
    });
    _bibleApiIds = {};
    for (const t of translations) {
      if (t.api_bible_id) {
        _bibleApiIds[t.code.toUpperCase()] = t.api_bible_id;
      }
    }
    return _bibleApiIds;
  } catch {
    // Fallback to empty if DB not available
    return {};
  }
}

/**
 * Parse a verse reference like "John 3:16" into API.Bible verse ID format.
 * API.Bible uses format like "JHN.3.16"
 *
 * @param reference - Human-readable verse reference (e.g., "John 3:16")
 * @returns API.Bible verse ID or null if parsing fails
 */
function parseVerseReference(reference: string): string | null {
  // Book name to API.Bible abbreviation mapping
  const BOOK_CODES: Record<string, string> = {
    genesis: 'GEN', exodus: 'EXO', leviticus: 'LEV', numbers: 'NUM',
    deuteronomy: 'DEU', joshua: 'JOS', judges: 'JDG', ruth: 'RUT',
    '1 samuel': '1SA', '2 samuel': '2SA', '1 kings': '1KI', '2 kings': '2KI',
    '1 chronicles': '1CH', '2 chronicles': '2CH', ezra: 'EZR', nehemiah: 'NEH',
    esther: 'EST', job: 'JOB', psalms: 'PSA', psalm: 'PSA', proverbs: 'PRO',
    ecclesiastes: 'ECC', 'song of solomon': 'SNG', isaiah: 'ISA', jeremiah: 'JER',
    lamentations: 'LAM', ezekiel: 'EZK', daniel: 'DAN', hosea: 'HOS',
    joel: 'JOL', amos: 'AMO', obadiah: 'OBA', jonah: 'JON', micah: 'MIC',
    nahum: 'NAM', habakkuk: 'HAB', zephaniah: 'ZEP', haggai: 'HAG',
    zechariah: 'ZEC', malachi: 'MAL',
    matthew: 'MAT', mark: 'MRK', luke: 'LUK', john: 'JHN',
    acts: 'ACT', romans: 'ROM', '1 corinthians': '1CO', '2 corinthians': '2CO',
    galatians: 'GAL', ephesians: 'EPH', philippians: 'PHP', colossians: 'COL',
    '1 thessalonians': '1TH', '2 thessalonians': '2TH',
    '1 timothy': '1TI', '2 timothy': '2TI', titus: 'TIT', philemon: 'PHM',
    hebrews: 'HEB', james: 'JAS', '1 peter': '1PE', '2 peter': '2PE',
    '1 john': '1JN', '2 john': '2JN', '3 john': '3JN', jude: 'JUD',
    revelation: 'REV',
  };

  try {
    // Match patterns like "John 3:16", "1 Corinthians 13:4-7", "Psalm 23:1"
    const match = reference.match(/^(\d?\s?[A-Za-z\s]+?)\s+(\d+):(\d+)(?:-\d+)?$/);
    if (!match) return null;

    const [, bookName, chapter, verse] = match;
    const normalizedBook = bookName.trim().toLowerCase();
    const bookCode = BOOK_CODES[normalizedBook];

    if (!bookCode) return null;

    return `${bookCode}.${chapter}.${verse}`;
  } catch {
    return null;
  }
}

/**
 * Strip HTML tags from API.Bible response text.
 * API.Bible returns content with HTML markup.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean verse text from API.Bible: remove pilcrows and verse number markers.
 */
function cleanVerseText(text: string): string {
  return text
    .replace(/\u00b6/g, '')
    .replace(/¶/g, '')
    .replace(/^\s*\[\d+\]\s*/, '')
    .replace(/^\s*\d+\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch a Bible verse from API.Bible (scripture.api.bible).
 * If BIBLE_API_KEY is not set, returns null silently.
 * On success, caches the translation to the DailyContentTranslation table.
 *
 * @param dailyContentId - The ID of the DailyContent record to cache against
 * @param verseReference - Human-readable verse reference (e.g., "John 3:16")
 * @param translationCode - Our translation code (e.g., "KJV", "NIV")
 * @returns The verse text or null if unavailable
 */
export async function fetchVerseFromBibleApi(
  dailyContentId: number,
  verseReference: string,
  translationCode: string
): Promise<string | null> {
  const apiKey = process.env.BIBLE_API_KEY;

  if (!apiKey) {
    console.warn('[bible-api] BIBLE_API_KEY not set, skipping API.Bible fallback');
    return null;
  }

  const bibleApiIds = await getBibleApiIds();
  const bibleId = bibleApiIds[translationCode.toUpperCase()];
  if (!bibleId) {
    console.warn(`[bible-api] No API.Bible ID for translation code: ${translationCode}`);
    return null;
  }

  const verseId = parseVerseReference(verseReference);
  if (!verseId) {
    console.warn(`[bible-api] Could not parse verse reference: ${verseReference}`);
    return null;
  }

  try {
    const url = `https://rest.api.bible/v1/bibles/${bibleId}/verses/${verseId}?content-type=text`;
    const response = await fetch(url, {
      headers: {
        'api-key': apiKey,
      },
    });

    if (!response.ok) {
      console.error(`[bible-api] API request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const content = data?.data?.content;

    if (!content) {
      console.warn('[bible-api] No content in API response');
      return null;
    }

    const verseText = cleanVerseText(stripHtml(content));

    if (!verseText) {
      return null;
    }

    // Cache the fetched translation to the database
    try {
      await DailyContentTranslation.create({
        daily_content_id: dailyContentId,
        translation_code: translationCode.toUpperCase(),
        translated_text: verseText,
        verse_reference: verseReference,
        source: 'api',
      });
      console.log(`[bible-api] Cached ${translationCode} translation for content ${dailyContentId}`);
    } catch (cacheError) {
      // Cache failure should not prevent returning the text
      console.error('[bible-api] Failed to cache translation:', cacheError);
    }

    return verseText;
  } catch (error) {
    console.error('[bible-api] Fetch error:', error);
    return null;
  }
}

/**
 * Parse a chapter reference like "John 3" into API.Bible chapter ID format.
 * API.Bible uses format like "JHN.3"
 */
function parseChapterReference(reference: string): string | null {
  const BOOK_CODES: Record<string, string> = {
    genesis: 'GEN', exodus: 'EXO', leviticus: 'LEV', numbers: 'NUM',
    deuteronomy: 'DEU', joshua: 'JOS', judges: 'JDG', ruth: 'RUT',
    '1 samuel': '1SA', '2 samuel': '2SA', '1 kings': '1KI', '2 kings': '2KI',
    '1 chronicles': '1CH', '2 chronicles': '2CH', ezra: 'EZR', nehemiah: 'NEH',
    esther: 'EST', job: 'JOB', psalms: 'PSA', psalm: 'PSA', proverbs: 'PRO',
    ecclesiastes: 'ECC', 'song of solomon': 'SNG', isaiah: 'ISA', jeremiah: 'JER',
    lamentations: 'LAM', ezekiel: 'EZK', daniel: 'DAN', hosea: 'HOS',
    joel: 'JOL', amos: 'AMO', obadiah: 'OBA', jonah: 'JON', micah: 'MIC',
    nahum: 'NAM', habakkuk: 'HAB', zephaniah: 'ZEP', haggai: 'HAG',
    zechariah: 'ZEC', malachi: 'MAL',
    matthew: 'MAT', mark: 'MRK', luke: 'LUK', john: 'JHN',
    acts: 'ACT', romans: 'ROM', '1 corinthians': '1CO', '2 corinthians': '2CO',
    galatians: 'GAL', ephesians: 'EPH', philippians: 'PHP', colossians: 'COL',
    '1 thessalonians': '1TH', '2 thessalonians': '2TH',
    '1 timothy': '1TI', '2 timothy': '2TI', titus: 'TIT', philemon: 'PHM',
    hebrews: 'HEB', james: 'JAS', '1 peter': '1PE', '2 peter': '2PE',
    '1 john': '1JN', '2 john': '2JN', '3 john': '3JN', jude: 'JUD',
    revelation: 'REV',
  };

  try {
    // Match "John 3" or "1 Corinthians 13" (with optional :verse suffix stripped)
    const match = reference.match(/^(\d?\s?[A-Za-z\s]+?)\s+(\d+)(?::.*)?$/);
    if (!match) return null;

    const [, bookName, chapter] = match;
    const bookCode = BOOK_CODES[bookName.trim().toLowerCase()];
    if (!bookCode) return null;

    return `${bookCode}.${chapter}`;
  } catch {
    return null;
  }
}

/**
 * Fetch a chapter from API.Bible.
 * Returns the full chapter text (all verses joined), or null.
 */
async function fetchChapterFromBibleApi(
  reference: string,
  translationCode: string
): Promise<string | null> {
  const apiKey = process.env.BIBLE_API_KEY;
  if (!apiKey) return null;

  const bibleApiIds = await getBibleApiIds();
  const bibleId = bibleApiIds[translationCode.toUpperCase()];
  if (!bibleId) return null;

  const chapterId = parseChapterReference(reference);
  if (!chapterId) return null;

  try {
    const url = `https://rest.api.bible/v1/bibles/${bibleId}/chapters/${chapterId}?content-type=text`;
    const response = await fetch(url, {
      headers: { 'api-key': apiKey },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.data?.content;
    if (!content) return null;

    return cleanVerseText(stripHtml(content));
  } catch {
    return null;
  }
}

/**
 * Fetch a standalone verse from API.Bible (no DB caching).
 * For general use outside the daily-content flow.
 */
async function fetchVerseTextFromBibleApi(
  reference: string,
  translationCode: string
): Promise<string | null> {
  const apiKey = process.env.BIBLE_API_KEY;
  if (!apiKey) return null;

  const bibleApiIds = await getBibleApiIds();
  const bibleId = bibleApiIds[translationCode.toUpperCase()];
  if (!bibleId) return null;

  const verseId = parseVerseReference(reference);
  if (!verseId) return null;

  try {
    const url = `https://rest.api.bible/v1/bibles/${bibleId}/verses/${verseId}?content-type=text`;
    const response = await fetch(url, {
      headers: { 'api-key': apiKey },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.data?.content;
    if (!content) return null;

    return cleanVerseText(stripHtml(content));
  } catch {
    return null;
  }
}

/**
 * Unified passage fetch — routes ESV to api.esv.org, all others to API.Bible.
 *
 * @param reference - Human-readable reference (e.g., "John 3:16" or "Psalm 23")
 * @param translationCode - Translation code (e.g., "ESV", "NIV", "KJV")
 * @param type - 'verse' for a single verse/range, 'chapter' for full chapter
 * @returns The passage text, or null if unavailable
 */
export async function fetchPassage(
  reference: string,
  translationCode: string,
  type: 'verse' | 'chapter' = 'verse'
): Promise<string | null> {
  const code = translationCode.toUpperCase();

  // ESV uses its own dedicated API
  if (code === 'ESV') {
    return fetchFromEsvApi(reference, type);
  }

  // All others use API.Bible
  if (type === 'chapter') {
    return fetchChapterFromBibleApi(reference, code);
  }

  return fetchVerseTextFromBibleApi(reference, code);
}

/**
 * Get available Bible API translation codes.
 */
export async function getAvailableBibleApiTranslations(): Promise<string[]> {
  const ids = await getBibleApiIds();
  return Object.keys(ids);
}

/**
 * Clear the cached Bible API IDs (e.g., after admin updates a translation).
 */
export function clearBibleApiCache(): void {
  _bibleApiIds = null;
}
