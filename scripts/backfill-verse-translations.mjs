/**
 * Backfill verse_category_content_translations from API.Bible
 *
 * For each verse in verse_category_content, fetches all available translations
 * from API.Bible and inserts into verse_category_content_translations.
 * Skips KJV (already exists) and translations not available on API.Bible (NAB, NRSV, ESV).
 *
 * Usage: node scripts/backfill-verse-translations.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import mysql from 'mysql2/promise';

const BIBLE_API_KEY = process.env.BIBLE_API_KEY;
if (!BIBLE_API_KEY) {
  console.error('BIBLE_API_KEY not set in .env.local');
  process.exit(1);
}

// Translation code -> API.Bible bible ID (from src/lib/bible-api/index.ts)
const BIBLE_API_IDS = {
  NIV:  '78a9f6124f344018-01',
  NKJV: '63097d2a0a2f7db3-01',
  NLT:  'd6e14a625393b4da-01',
  CSB:  'a556c5305ee15c3f-01',
  NIRV: '5b888a42e2d9a89d-01',
  AMP:  'a81b73293d3080c9-01',
  NVI:  '01c25b8715dbb632-01',
  RVR:  '592420522e16049f-01',
};

const TRANSLATION_CODES = Object.keys(BIBLE_API_IDS);

// Book name -> API.Bible abbreviation
const BOOK_CODES = {
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

function parseVerseReference(reference) {
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

function cleanVerseText(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\u00b6/g, '')
    // Strip section heading + [verse_number] from start
    .replace(/^.*?\[\d+\]\s*/, '')
    // Remove remaining [number] markers
    .replace(/\s*\[\d+\]\s*/g, ' ')
    // Remove cross-reference brackets (e.g., [Ex 3:14], [Heb 11:13])
    .replace(/\s*\[[^\]]*\d+:\d+[^\]]*\]\s*/g, ' ')
    // AMP-style: keep content, remove brackets
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/^\s*\d+\s+/, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchFromBibleApi(bibleId, verseId) {
  const url = `https://rest.api.bible/v1/bibles/${bibleId}/verses/${verseId}?content-type=text&include-titles=false`;
  const res = await fetch(url, { headers: { 'api-key': BIBLE_API_KEY } });
  if (!res.ok) return null;
  const data = await res.json();
  const content = data?.data?.content;
  if (!content) return null;
  return cleanVerseText(content);
}

// Rate limiter: max N requests per second
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  // Get all verses
  const [verses] = await conn.query(
    'SELECT id, verse_reference FROM verse_category_content ORDER BY id'
  );
  console.log(`Found ${verses.length} verses to backfill translations for`);
  console.log(`Translations to fetch: ${TRANSLATION_CODES.join(', ')}`);
  console.log(`Estimated API calls: ~${verses.length * TRANSLATION_CODES.length}`);
  console.log('');

  // Get existing translations to skip
  const [existing] = await conn.query(
    "SELECT verse_category_content_id, translation_code FROM verse_category_content_translations WHERE translation_code != 'KJV'"
  );
  const existingSet = new Set(existing.map(r => `${r.verse_category_content_id}:${r.translation_code}`));
  console.log(`Existing non-KJV translations: ${existingSet.size} (will skip)`);

  let totalInserted = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < verses.length; i++) {
    const verse = verses[i];
    const verseId = parseVerseReference(verse.verse_reference);

    if (!verseId) {
      if (i % 500 === 0) console.log(`  [${i}/${verses.length}] Cannot parse: ${verse.verse_reference}`);
      totalFailed += TRANSLATION_CODES.length;
      continue;
    }

    for (const code of TRANSLATION_CODES) {
      const key = `${verse.id}:${code}`;
      if (existingSet.has(key)) {
        totalSkipped++;
        continue;
      }

      try {
        const text = await fetchFromBibleApi(BIBLE_API_IDS[code], verseId);
        if (text) {
          await conn.query(
            'INSERT IGNORE INTO verse_category_content_translations (verse_category_content_id, translation_code, translated_text, source, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [verse.id, code, text, 'api']
          );
          totalInserted++;
        } else {
          totalFailed++;
        }
      } catch (err) {
        totalFailed++;
      }

      // Rate limit: ~5 requests/sec to be safe with API.Bible
      await sleep(200);
    }

    if ((i + 1) % 100 === 0 || i === verses.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (totalInserted / (elapsed || 1)).toFixed(1);
      console.log(`  Progress: ${i + 1}/${verses.length} verses | Inserted: ${totalInserted} | Failed: ${totalFailed} | Skipped: ${totalSkipped} | ${elapsed}s elapsed (${rate}/s)`);
    }
  }

  const [final] = await conn.query('SELECT COUNT(*) as total FROM verse_category_content_translations');
  console.log('');
  console.log('=== COMPLETE ===');
  console.log(`Inserted: ${totalInserted}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Skipped (already existed): ${totalSkipped}`);
  console.log(`Total translations now: ${final[0].total}`);
  console.log(`Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`);

  await conn.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
