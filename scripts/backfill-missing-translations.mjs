#!/usr/bin/env node
/**
 * Backfill missing daily_content_translations for Feb 5-13, 2026.
 * Fetches verse text + chapter text from API.Bible (rest.api.bible).
 */
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- API.Bible config ----------
const API_KEY = '32_GZ2K38lem4NMFC6U29';
const API_BASE = 'https://rest.api.bible/v1/bibles';

const BIBLE_IDS = {
  // English
  KJV:  'de4e12af7f28f599-02',
  NIV:  '78a9f6124f344018-01',
  NRSV: '1e8ab327edbce67f-01',
  NAB:  'bba9f40183526463-01',
  NKJV: '63097d2a0a2f7db3-01',
  NLT:  'd6e14a625393b4da-01',
  CSB:  'a556c5305ee15c3f-01',
  NIRV: '5b888a42e2d9a89d-01',
  AMP:  'a81b73293d3080c9-01',
  ESV:  '9879dbb7cfe39e4d-04',
  // Spanish
  NVI:  '01c25b8715dbb632-01',  // Nueva Versión Internacional 2022
  RVR:  '592420522e16049f-01',  // Reina Valera 1909
};

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

// ---------- Helpers ----------

function parseVerseReference(ref) {
  const m = ref.match(/^(\d?\s?[A-Za-z\s]+?)\s+(\d+):(\d+)(?:-\d+)?$/);
  if (!m) return null;
  const bookCode = BOOK_CODES[m[1].trim().toLowerCase()];
  if (!bookCode) return null;
  return `${bookCode}.${m[2]}.${m[3]}`;
}

function parseChapterReference(chapterRef, verseRef) {
  if (!chapterRef) return null;
  // Try "Book Chapter" format (e.g., "Colossians 2")
  const m = chapterRef.trim().match(/^(\d?\s?[A-Za-z\s]+?)\s+(\d+)$/);
  if (m) {
    const code = BOOK_CODES[m[1].trim().toLowerCase()];
    if (code) return `${code}.${m[2]}`;
  }
  // Fallback: extract chapter from verse ref
  const book = chapterRef.trim().toLowerCase();
  const code = BOOK_CODES[book];
  if (code && verseRef) {
    const vm = verseRef.match(/^(\d?\s?[A-Za-z\s]+?)\s+(\d+):\d+/);
    if (vm) return `${code}.${vm[2]}`;
  }
  return null;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function cleanVerseText(text) {
  text = text.replace(/\u00b6/g, '').replace(/¶/g, '');
  // Strip section heading + [verse_number] from start
  text = text.replace(/^.*?\[\d+\]\s*/, '');
  // Remove remaining [number] markers
  text = text.replace(/\s*\[\d+\]\s*/g, ' ');
  // Remove cross-reference brackets (e.g., [Ex 3:14], [Heb 11:13])
  text = text.replace(/\s*\[[^\]]*\d+:\d+[^\]]*\]\s*/g, ' ');
  // AMP-style: keep content, remove brackets
  text = text.replace(/\[([^\]]+)\]/g, '$1');
  text = text.replace(/^\s*\d+\s+/, '');
  return text.replace(/\s+/g, ' ').trim();
}

function cleanChapterText(text) {
  text = text.replace(/\u00b6/g, '').replace(/¶/g, '');
  text = text.replace(/\s*\[\d+\]\s*/g, '|');
  if (!text.includes('|')) {
    text = text.replace(/^\s*\d+\s+/, '|');
    text = text.replace(/\s+(\d+)\s+/g, ' |');
  }
  text = text.replace(/\s*\|\s*/g, '|');
  text = text.replace(/\|+/g, '|');
  // Strip leading chapter number + section heading before first pipe
  text = text.replace(/^\|?\d+\s+[^|]+\|/, '|');
  // Remove cross-reference brackets
  text = text.replace(/\s*\[[^\]]*\d+:\d+[^\]]*\]\s*/g, ' ');
  // AMP-style: keep content, remove brackets
  text = text.replace(/\[([^\]]+)\]/g, '$1');
  text = text.replace(/\s+/g, ' ').trim();
  if (text && !text.startsWith('|')) text = '|' + text;
  return text;
}

async function fetchVerse(bibleId, verseId) {
  const url = `${API_BASE}/${bibleId}/verses/${verseId}?content-type=text&include-titles=false`;
  try {
    const res = await fetch(url, { headers: { 'api-key': API_KEY } });
    if (!res.ok) {
      console.error(`    API ${res.status} for verse ${verseId}`);
      return null;
    }
    const data = await res.json();
    const content = data?.data?.content;
    return content ? cleanVerseText(stripHtml(content)) : null;
  } catch (err) {
    console.error(`    Fetch error: ${err.message}`);
    return null;
  }
}

async function fetchChapter(bibleId, chapterId) {
  const url = `${API_BASE}/${bibleId}/chapters/${chapterId}?content-type=text&include-titles=false`;
  try {
    const res = await fetch(url, { headers: { 'api-key': API_KEY } });
    if (!res.ok) {
      console.error(`    API ${res.status} for chapter ${chapterId}`);
      return null;
    }
    const data = await res.json();
    const content = data?.data?.content;
    return content ? cleanChapterText(stripHtml(content)) : null;
  } catch (err) {
    console.error(`    Fetch error: ${err.message}`);
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------- Main ----------
const conn = await mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev',
});

// Load the missing translations export
const exportPath = path.join(__dirname, '..', 'missing-daily-content-export.json');
const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));

console.log('='.repeat(60));
console.log('Bible API Backfill — Missing Translations');
console.log('='.repeat(60));
console.log(`\nMissing entries: ${exportData.missing_translations.length} rows`);
console.log(`Total missing translation codes: ${exportData.summary.total_missing_translation_entries}\n`);

let inserted = 0;
let failed = 0;
let skipped = 0;

for (const entry of exportData.missing_translations) {
  const { date, language, daily_content_id, verse_reference, chapter_reference, missing_translations } = entry;

  for (const code of missing_translations) {
    const bibleId = BIBLE_IDS[code];
    if (!bibleId) {
      console.log(`  SKIP ${date} ${language}/${code}: No Bible ID mapped`);
      skipped++;
      continue;
    }

    const verseApiId = parseVerseReference(verse_reference);
    const chapterApiId = parseChapterReference(chapter_reference, verse_reference);

    if (!verseApiId) {
      console.log(`  SKIP ${date} ${code}: Can't parse verse ref "${verse_reference}"`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${date} (${language}) ${code}: fetching verse ${verseApiId}...`);
    const verseText = await fetchVerse(bibleId, verseApiId);
    await sleep(300); // rate limit

    let chapterText = null;
    if (chapterApiId) {
      process.stdout.write(' chapter...');
      chapterText = await fetchChapter(bibleId, chapterApiId);
      await sleep(300);
    }

    if (!verseText) {
      console.log(' FAILED (no verse text)');
      failed++;
      continue;
    }

    // Insert into DB
    try {
      await conn.execute(
        `INSERT INTO daily_content_translations
         (daily_content_id, translation_code, translated_text, chapter_text, verse_reference, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'api', NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           translated_text = VALUES(translated_text),
           chapter_text = VALUES(chapter_text),
           source = 'api',
           updated_at = NOW()`,
        [daily_content_id, code, verseText, chapterText, verse_reference]
      );
      const chLen = chapterText ? chapterText.length : 0;
      console.log(` OK (verse: ${verseText.length} chars, chapter: ${chLen} chars)`);
      inserted++;
    } catch (err) {
      console.log(` DB ERROR: ${err.message}`);
      failed++;
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('BACKFILL COMPLETE');
console.log('='.repeat(60));
console.log(`Inserted: ${inserted}`);
console.log(`Failed:   ${failed}`);
console.log(`Skipped:  ${skipped}`);

// Verify
const [remaining] = await conn.query(`
  SELECT COUNT(*) as cnt
  FROM daily_content dc
  JOIN bible_translations bt ON bt.active = 1 AND bt.language = dc.language
  LEFT JOIN daily_content_translations dct
    ON dct.daily_content_id = dc.id AND dct.translation_code = bt.code
  WHERE dc.mode = 'bible'
    AND dc.post_date BETWEEN '2026-02-05' AND '2026-02-13'
    AND dct.id IS NULL
`);
console.log(`\nRemaining missing for Feb 5-13: ${remaining[0].cnt}`);

await conn.end();
