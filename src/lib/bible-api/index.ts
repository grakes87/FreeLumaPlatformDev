import { DailyContentTranslation } from '@/lib/db/models';

/**
 * Mapping of our translation codes to API.Bible Bible IDs.
 * See: https://scripture.api.bible/listeditions
 */
const BIBLE_API_IDS: Record<string, string> = {
  KJV: 'de4e12af7f28f599-02',   // King James Version
  NIV: '78a9f6124f344018-01',   // New International Version (partial)
  NRSV: '1e8ab327edbce67f-01',  // New Revised Standard Version (partial)
  NAB: 'bba9f40183526463-01',   // New American Bible (Revised Edition)
};

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

  const bibleId = BIBLE_API_IDS[translationCode.toUpperCase()];
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
    const url = `https://api.scripture.api.bible/v1/bibles/${bibleId}/verses/${verseId}`;
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

    const verseText = stripHtml(content);

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
 * Get available Bible API translation codes.
 */
export function getAvailableBibleApiTranslations(): string[] {
  return Object.keys(BIBLE_API_IDS);
}
