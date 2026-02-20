import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * Mapping of our translation codes to API.Bible Bible IDs.
 * Duplicated from bible-api/index.ts to avoid importing the daily-content caching version.
 */
const BIBLE_API_IDS: Record<string, string> = {
  KJV: 'de4e12af7f28f599-02',
  NIV: '78a9f6124f344018-01',
  NKJV: '63097d2a0a2f7db3-01',
  NLT: 'd6e14a625393b4da-01',
  CSB: 'a556c5305ee15c3f-01',
  NIRV: '5b888a42e2d9a89d-01',
  AMP: 'a81b73293d3080c9-01',
  NVI: '01c25b8715dbb632-01',
  RVR: '592420522e16049f-01',
};

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

/**
 * Parse a verse reference like "John 3:16" into API.Bible verse ID format.
 */
function parseVerseReference(reference: string): string | null {
  try {
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
 * Extract the book name from a verse reference.
 */
function extractBookName(reference: string): string {
  const match = reference.match(/^(\d?\s?[A-Za-z\s]+?)\s+\d/);
  return match ? match[1].trim() : reference;
}

/**
 * Clean verse text: remove pilcrows, HTML tags, verse number markers, curly/smart quotes.
 */
function cleanVerseText(text: string): string {
  return text
    .replace(/\u00b6/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/^\s*\d+\s+/, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch a single verse from API.Bible for a given translation.
 */
async function fetchVerseText(
  verseReference: string,
  translationCode: string
): Promise<string | null> {
  const apiKey = process.env.BIBLE_API_KEY;
  if (!apiKey) return null;

  const bibleId = BIBLE_API_IDS[translationCode.toUpperCase()];
  if (!bibleId) return null;

  const verseId = parseVerseReference(verseReference);
  if (!verseId) return null;

  try {
    const url = `https://rest.api.bible/v1/bibles/${bibleId}/verses/${verseId}?content-type=text`;
    const response = await fetch(url, {
      headers: { 'api-key': apiKey },
    });

    if (!response.ok) {
      console.error(`[verse-api] ${translationCode} fetch failed: ${response.status} for ${verseReference}`);
      return null;
    }

    const data = await response.json();
    const content = data?.data?.content;
    if (!content) return null;

    return cleanVerseText(content);
  } catch (error) {
    console.error(`[verse-api] ${translationCode} fetch error for ${verseReference}:`, error);
    return null;
  }
}

/**
 * GET /api/admin/verse-categories/[id]/verses
 * List all verses in category with translations. Paginated (limit/offset).
 */
export const GET = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const categoryId = parseInt(params.id, 10);
    if (isNaN(categoryId)) {
      return errorResponse('Invalid category ID');
    }

    const { VerseCategoryContent, VerseCategoryContentTranslation, VerseCategory, sequelize } = await import('@/lib/db/models');
    const { literal } = await import('sequelize');

    // Verify category exists
    const category = await VerseCategory.findByPk(categoryId);
    if (!category) {
      return errorResponse('Category not found', 404);
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const { count, rows: verses } = await VerseCategoryContent.findAndCountAll({
      where: { category_id: categoryId },
      attributes: {
        include: [
          [
            literal('(SELECT COUNT(*) FROM verse_category_reactions WHERE verse_category_reactions.verse_category_content_id = VerseCategoryContent.id)'),
            'reaction_count',
          ],
          [
            literal('(SELECT COUNT(*) FROM verse_category_comments WHERE verse_category_comments.verse_category_content_id = VerseCategoryContent.id)'),
            'comment_count',
          ],
        ],
      },
      include: [
        {
          model: VerseCategoryContentTranslation,
          as: 'translations',
          attributes: ['id', 'translation_code', 'translated_text', 'source'],
        },
      ],
      order: [['id', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse({
      verses,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch verses');
  }
});

const postSchema = z.object({
  verse_reference: z.string().min(1).max(255),
  content_text: z.string().optional(),
  auto_fetch: z.boolean().optional().default(true),
});

/**
 * POST /api/admin/verse-categories/[id]/verses
 * Add a verse to a category. If auto_fetch (default true), fetches KJV text as content_text
 * and fetches all other translations from bible.api.
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const categoryId = parseInt(params.id, 10);
    if (isNaN(categoryId)) {
      return errorResponse('Invalid category ID');
    }

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { verse_reference, content_text, auto_fetch } = parsed.data;

    const {
      VerseCategory,
      VerseCategoryContent,
      VerseCategoryContentTranslation,
      BibleTranslation,
      sequelize,
    } = await import('@/lib/db/models');

    // Verify category exists
    const category = await VerseCategory.findByPk(categoryId);
    if (!category) {
      return errorResponse('Category not found', 404);
    }

    // Check UNIQUE constraint (category_id, verse_reference)
    const existing = await VerseCategoryContent.findOne({
      where: { category_id: categoryId, verse_reference },
    });
    if (existing) {
      return errorResponse('This verse already exists in this category', 409);
    }

    const book = extractBookName(verse_reference);
    let finalContentText = content_text || '';

    // Auto-fetch KJV text as content_text
    if (auto_fetch) {
      const kjvText = await fetchVerseText(verse_reference, 'KJV');
      if (kjvText) {
        finalContentText = kjvText;
      } else if (!content_text) {
        return errorResponse(
          'Could not fetch KJV text from bible.api. Provide content_text manually or check the verse reference.',
          422
        );
      }
    }

    if (!finalContentText) {
      return errorResponse('content_text is required when auto_fetch is disabled');
    }

    const transaction = await sequelize.transaction();

    try {
      // Create verse
      const verse = await VerseCategoryContent.create(
        {
          category_id: categoryId,
          verse_reference,
          content_text: finalContentText,
          book,
        },
        { transaction }
      );

      // Auto-fetch translations
      if (auto_fetch) {
        // Get all active translation codes from bible_translations table
        const translations = await BibleTranslation.findAll({
          where: { active: true },
          attributes: ['code'],
          raw: true,
        });

        const translationRecords: Array<{
          verse_category_content_id: number;
          translation_code: string;
          translated_text: string;
          source: 'database' | 'api';
        }> = [];

        for (const t of translations) {
          const code = t.code.toUpperCase();

          // KJV already stored as content_text, also save as translation
          if (code === 'KJV' && finalContentText) {
            translationRecords.push({
              verse_category_content_id: verse.id,
              translation_code: 'KJV',
              translated_text: finalContentText,
              source: 'api',
            });
            continue;
          }

          try {
            const text = await fetchVerseText(verse_reference, code);
            if (text) {
              translationRecords.push({
                verse_category_content_id: verse.id,
                translation_code: code,
                translated_text: text,
                source: 'api',
              });
            } else {
              console.warn(`[verse-admin] No text returned for ${verse_reference} ${code}`);
            }
          } catch (err) {
            console.error(`[verse-admin] Failed to fetch ${code} for ${verse_reference}:`, err);
          }
        }

        if (translationRecords.length > 0) {
          await VerseCategoryContentTranslation.bulkCreate(translationRecords, { transaction });
        }
      }

      await transaction.commit();

      // Fetch the created verse with translations for response
      const created = await VerseCategoryContent.findByPk(verse.id, {
        include: [
          {
            model: VerseCategoryContentTranslation,
            as: 'translations',
            attributes: ['id', 'translation_code', 'translated_text', 'source'],
          },
        ],
      });

      return successResponse({ verse: created }, 201);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    if ((error as { name?: string }).name === 'SequelizeUniqueConstraintError') {
      return errorResponse('This verse already exists in this category', 409);
    }
    return serverError(error, 'Failed to add verse');
  }
});

const putVerseSchema = z.object({
  verse_id: z.number().int().positive(),
  verse_reference: z.string().min(1).max(255).optional(),
  content_text: z.string().min(1).optional(),
});

/**
 * PUT /api/admin/verse-categories/[id]/verses
 * Edit a verse. Does NOT re-fetch translations (manual corrections only).
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const categoryId = parseInt(params.id, 10);
    if (isNaN(categoryId)) {
      return errorResponse('Invalid category ID');
    }

    const body = await req.json();
    const parsed = putVerseSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { verse_id, verse_reference, content_text } = parsed.data;

    const { VerseCategoryContent, VerseCategoryContentTranslation } = await import('@/lib/db/models');

    const verse = await VerseCategoryContent.findOne({
      where: { id: verse_id, category_id: categoryId },
    });
    if (!verse) {
      return errorResponse('Verse not found in this category', 404);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    if (verse_reference !== undefined) {
      updates.verse_reference = verse_reference;
      updates.book = extractBookName(verse_reference);
    }
    if (content_text !== undefined) {
      updates.content_text = content_text;
    }

    if (Object.keys(updates).length > 0) {
      await verse.update(updates);
    }

    // Return updated verse with translations
    const updated = await VerseCategoryContent.findByPk(verse_id, {
      include: [
        {
          model: VerseCategoryContentTranslation,
          as: 'translations',
          attributes: ['id', 'translation_code', 'translated_text', 'source'],
        },
      ],
    });

    return successResponse({ verse: updated });
  } catch (error) {
    if ((error as { name?: string }).name === 'SequelizeUniqueConstraintError') {
      return errorResponse('This verse reference already exists in this category', 409);
    }
    return serverError(error, 'Failed to update verse');
  }
});

/**
 * DELETE /api/admin/verse-categories/[id]/verses
 * Remove a verse by verse_id. CASCADE deletes translations, reactions, comments.
 */
export const DELETE = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const categoryId = parseInt(params.id, 10);
    if (isNaN(categoryId)) {
      return errorResponse('Invalid category ID');
    }

    const url = new URL(req.url);
    const verseId = parseInt(url.searchParams.get('verse_id') || '', 10);
    if (isNaN(verseId)) {
      return errorResponse('verse_id query parameter is required');
    }

    const { VerseCategoryContent } = await import('@/lib/db/models');

    const verse = await VerseCategoryContent.findOne({
      where: { id: verseId, category_id: categoryId },
    });
    if (!verse) {
      return errorResponse('Verse not found in this category', 404);
    }

    // CASCADE will handle translations, reactions, comments
    await verse.destroy();

    return successResponse({ success: true, deleted_verse_id: verseId });
  } catch (error) {
    return serverError(error, 'Failed to delete verse');
  }
});
