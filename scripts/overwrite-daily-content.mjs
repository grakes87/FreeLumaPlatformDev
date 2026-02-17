#!/usr/bin/env node
/**
 * Overwrite daily_content and daily_content_translations for dates 2026-02-05 through 2026-02-13
 * using data extracted from the old freelumacontent and freelumamedia databases.
 *
 * SAFE: Only touches the specified date range. Uses pre-extracted JSON + parsed video URLs.
 *
 * Usage: node scripts/overwrite-daily-content.mjs
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_CONFIG = {
  host: '127.0.0.1',
  user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev',
};

const DATE_START = '2026-02-05';
const DATE_END = '2026-02-13';

// ── Old DB ID Mappings ──────────────────────────────────────────────

// Content DB: bible_data DailyPostIds (no-category rows) → date
const BIBLE_CONTENT_IDS = {
  1744: '2026-02-05', 1745: '2026-02-06', 1746: '2026-02-07',
  1747: '2026-02-08', 1748: '2026-02-09', 1749: '2026-02-10',
  1750: '2026-02-11', 1751: '2026-02-12', 1752: '2026-02-13',
};

// Content DB: positivity DailyPostIds
const POS_CONTENT_IDS = {
  2114: { date: '2026-02-05', lang: 'en' }, 2115: { date: '2026-02-05', lang: 'es' },
  2116: { date: '2026-02-06', lang: 'en' }, 2117: { date: '2026-02-06', lang: 'es' },
  2118: { date: '2026-02-07', lang: 'en' }, 2119: { date: '2026-02-07', lang: 'es' },
  2120: { date: '2026-02-08', lang: 'en' }, 2121: { date: '2026-02-08', lang: 'es' },
  2122: { date: '2026-02-09', lang: 'en' }, 2123: { date: '2026-02-09', lang: 'es' },
  2124: { date: '2026-02-10', lang: 'en' }, 2125: { date: '2026-02-10', lang: 'es' },
  2126: { date: '2026-02-11', lang: 'en' }, 2127: { date: '2026-02-11', lang: 'es' },
  2128: { date: '2026-02-12', lang: 'en' }, 2129: { date: '2026-02-12', lang: 'es' },
  2130: { date: '2026-02-13', lang: 'en' }, 2131: { date: '2026-02-13', lang: 'es' },
};

// Media DB: bible DailyPostIds → date + language
const BIBLE_MEDIA_IDS = {
  737: { date: '2026-02-05', lang: 'en' }, 738: { date: '2026-02-05', lang: 'es' },
  739: { date: '2026-02-06', lang: 'en' }, 740: { date: '2026-02-06', lang: 'es' },
  741: { date: '2026-02-07', lang: 'en' }, 742: { date: '2026-02-07', lang: 'es' },
  743: { date: '2026-02-08', lang: 'en' }, 744: { date: '2026-02-08', lang: 'es' },
  761: { date: '2026-02-09', lang: 'en' }, 762: { date: '2026-02-09', lang: 'es' },
  763: { date: '2026-02-10', lang: 'en' }, 764: { date: '2026-02-10', lang: 'es' },
  765: { date: '2026-02-11', lang: 'en' }, 766: { date: '2026-02-11', lang: 'es' },
  767: { date: '2026-02-12', lang: 'en' }, 768: { date: '2026-02-12', lang: 'es' },
  769: { date: '2026-02-13', lang: 'en' }, 770: { date: '2026-02-13', lang: 'es' },
};

// Media DB: positivity DailyPostIds → date
const POS_MEDIA_IDS = {};
for (let i = 0; i < 9; i++) {
  POS_MEDIA_IDS[282 + i] = `2026-02-${String(5 + i).padStart(2, '0')}`;
}

// ── Video URLs (parsed from freelumamedia.sql dailyposts table) ─────
const VIDEO_URLS = {
  '2026-02-05': {
    bible: { en: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-05/2026-02-05-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-05/2026-02-05.mp4' }, es: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-05/2026-02-05-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-05/2026-02-05-Spanish.mp4' } },
  },
  '2026-02-06': {
    bible: { en: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-06/2026-02-06-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-06/2026-02-06.mp4' }, es: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-06/2026-02-06-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-06/2026-02-06-Spanish.mp4' } },
  },
  '2026-02-07': {
    bible: { en: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-07/2026-02-07-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-07/2026-02-07.mp4' }, es: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-07/2026-02-07-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-07/2026-02-07-Spanish.mp4' } },
  },
  '2026-02-08': {
    bible: { en: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-08/2026-02-08-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-08/2026-02-08.mp4' }, es: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-08/2026-02-08-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-08/2026-02-08-Spanish.mp4' } },
  },
  '2026-02-09': {
    bible: { en: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-09/2026-02-09-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-09/2026-02-09.mp4' }, es: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-09/2026-02-09-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-09/2026-02-09-Spanish.mp4' } },
  },
  '2026-02-10': {
    bible: { en: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-10/2026-02-10-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-10/2026-02-10.mp4' }, es: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-10/2026-02-10-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-10/2026-02-10-Spanish.mp4' } },
  },
  '2026-02-11': {
    bible: { en: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-11/2026-02-11-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-11/2026-02-11.mp4' }, es: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-11/2026-02-11-background.mp4', daily: null } },
  },
  '2026-02-12': {
    bible: { en: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-12/2026-02-12-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-12/2026-02-12.mp4' }, es: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-12/2026-02-12-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-12/2026-02-12-Spanish.mp4' } },
  },
  '2026-02-13': {
    bible: { en: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-13/2026-02-13-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-13/2026-02-13.mp4' }, es: { bg: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/background/2026-02-13/2026-02-13-background.mp4', daily: 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily/Bible/dailyvideos/2026-02-13/2026-02-13-Spanish.mp4' } },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeLang(language) {
  return (language || '').toLowerCase().includes('spanish') ? 'es' : 'en';
}

/** Normalize old translation codes to our standard. Returns null for FreeLuma/POSITIVITY (main content). */
function normalizeCode(abv, language) {
  const upper = (abv || '').toUpperCase().trim();
  if (upper === 'FREELUMA' || upper === 'POSITIVITY') return null;

  // Short codes from media DB
  if (upper === 'KJ') return 'KJV';
  if (upper === 'NI') return 'NIV';
  if (upper === 'ES') return 'ESV';

  // Handle -SPANISH suffix
  if (upper.endsWith('-SPANISH')) {
    const base = upper.replace(/-SPANISH$/, '');
    if (base === 'KJ') return 'KJV';
    if (base === 'NI') return 'NIV';
    if (base === 'ES') return 'ESV';
    if (base === 'NIRV') return 'NIRV';
    return base;
  }

  return upper;
}

/** Extract chapter reference from verse reference (e.g., "Colossians 2:23" → "Colossians 2") */
function extractChapterRef(verseRef) {
  if (!verseRef) return null;
  const m = verseRef.match(/^(.+?)\s+(\d+):/);
  if (m) return `${m[1]} ${m[2]}`;
  const m2 = verseRef.match(/^(.+?)\s+(\d+)$/);
  if (m2) return `${m2[1]} ${m2[2]}`;
  return verseRef;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Overwrite Daily Content (Feb 5-13, 2026) ===\n');

  // Load extracted JSON (bible_data from both old DBs)
  const extractPath = path.join(__dirname, 'bible-data-extract.json');
  if (!fs.existsSync(extractPath)) {
    console.error('ERROR: bible-data-extract.json not found. Run extract-bible-data.mjs first.');
    process.exit(1);
  }
  const extracted = JSON.parse(fs.readFileSync(extractPath, 'utf8'));
  console.log(`Loaded: ${extracted.content.length} content rows, ${extracted.media.length} media rows\n`);

  // ── Build bible content map: date → { en: [...translations], es: [...translations] } ──
  const bibleMap = {}; // date → { en: [{ code, verseText, chapterText, verseRef, book }], es: [...] }
  for (const row of extracted.content) {
    const date = BIBLE_CONTENT_IDS[row.DailyPostId];
    if (!date) continue; // not a bible row or not in our range
    const lang = normalizeLang(row.Language);
    const code = normalizeCode(row.TranslationAbv, row.Language);

    if (!bibleMap[date]) bibleMap[date] = { en: [], es: [] };

    bibleMap[date][lang].push({
      code, // null for FreeLuma (main content)
      verseText: row.VerseText || '',
      chapterText: row.ChapterText || '',
      verseRef: row.VerseReference || '',
      book: row.Book || '',
      isFreeLuma: !code,
      rawAbv: row.TranslationAbv,
    });
  }

  // ── Build positivity content map: date → lang → { verseText, chapterText } ──
  const posContentMap = {};
  for (const row of extracted.content) {
    const info = POS_CONTENT_IDS[row.DailyPostId];
    if (!info) continue;
    if (!posContentMap[info.date]) posContentMap[info.date] = {};
    posContentMap[info.date][info.lang] = {
      verseText: row.VerseText || '',
      chapterText: row.ChapterText || '',
    };
  }

  // ── Build positivity verse text from media (unique daily quotes per date) ──
  const posMediaVerses = {};
  for (const row of extracted.media) {
    const date = POS_MEDIA_IDS[row.DailyPostId];
    if (!date) continue;
    const lang = normalizeLang(row.Language);
    if (row.VerseText?.trim()) {
      if (!posMediaVerses[date]) posMediaVerses[date] = {};
      posMediaVerses[date][lang] = row.VerseText.trim();
    }
  }

  // ── Build positivity chapter text from media ──
  const posMediaChapters = {};
  for (const row of extracted.media) {
    const date = POS_MEDIA_IDS[row.DailyPostId];
    if (!date) continue;
    const lang = normalizeLang(row.Language);
    if (row.ChapterText?.trim()) {
      if (!posMediaChapters[date]) posMediaChapters[date] = {};
      posMediaChapters[date][lang] = row.ChapterText.trim();
    }
  }

  // ── Build audio URL map from media DB: date → lang → code → { audioUrl, srtUrl } ──
  const audioMap = {};
  for (const row of extracted.media) {
    const bibleInfo = BIBLE_MEDIA_IDS[row.DailyPostId];
    if (!bibleInfo) continue;
    const rowLang = normalizeLang(row.Language);
    const code = normalizeCode(row.TranslationAbv, row.Language);
    if (!code || !row.AudioUrl) continue;

    const { date } = bibleInfo;
    if (!audioMap[date]) audioMap[date] = {};
    if (!audioMap[date][rowLang]) audioMap[date][rowLang] = {};
    audioMap[date][rowLang][code] = {
      audioUrl: row.AudioUrl || null,
      srtUrl: row.SrtUrl || null,
    };
  }

  // ── Build positivity audio map: date → lang → { audioUrl, srtUrl } ──
  const posAudioMap = {};
  for (const row of extracted.media) {
    const date = POS_MEDIA_IDS[row.DailyPostId];
    if (!date) continue;
    const lang = normalizeLang(row.Language);
    if (row.AudioUrl) {
      if (!posAudioMap[date]) posAudioMap[date] = {};
      posAudioMap[date][lang] = {
        audioUrl: row.AudioUrl || null,
        srtUrl: row.SrtUrl || null,
      };
    }
  }

  // ── Connect and overwrite ─────────────────────────────────────────
  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    // Delete existing data for the date range ONLY
    const [existingRows] = await conn.query(
      `SELECT id FROM daily_content WHERE post_date BETWEEN ? AND ?`,
      [DATE_START, DATE_END]
    );
    const existingIds = existingRows.map(r => r.id);

    if (existingIds.length > 0) {
      // Temporarily disable FK checks to allow cascading delete
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      // Delete related records first
      await conn.query(
        `DELETE FROM daily_comment_reactions WHERE comment_id IN (SELECT id FROM daily_comments WHERE daily_content_id IN (?))`,
        [existingIds]
      );
      await conn.query(
        `DELETE FROM daily_comments WHERE daily_content_id IN (?)`,
        [existingIds]
      );
      await conn.query(
        `DELETE FROM daily_content_translations WHERE daily_content_id IN (?)`,
        [existingIds]
      );
      await conn.query(
        `DELETE FROM daily_content WHERE post_date BETWEEN ? AND ?`,
        [DATE_START, DATE_END]
      );
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log(`Deleted ${existingIds.length} existing daily_content rows + related data\n`);
    }

    // Generate dates
    const dates = [];
    for (let d = new Date(DATE_START + 'T00:00:00'); d <= new Date(DATE_END + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }

    let totalDC = 0;
    let totalTrans = 0;

    for (const date of dates) {
      const bibleData = bibleMap[date];
      const videos = VIDEO_URLS[date];

      // ════════════════ BIBLE ENGLISH ════════════════
      if (bibleData?.en?.length > 0) {
        const enTrans = bibleData.en.filter(t => !t.isFreeLuma);
        const kjv = enTrans.find(t => t.code === 'KJV');
        const verseRef = kjv?.verseRef || enTrans[0]?.verseRef || '';
        const chapterRef = extractChapterRef(verseRef);
        const contentText = kjv?.verseText || enTrans[0]?.verseText || '';
        const bgUrl = videos?.bible?.en?.bg || '';
        const dailyUrl = videos?.bible?.en?.daily || null;

        const [res] = await conn.query(
          `INSERT INTO daily_content (post_date, mode, title, content_text, verse_reference, chapter_reference, video_background_url, lumashort_video_url, language, published) VALUES (?, 'bible', 'Daily Verse', ?, ?, ?, ?, ?, 'en', 1)`,
          [date, contentText, verseRef, chapterRef, bgUrl, dailyUrl]
        );
        const dcId = res.insertId;
        totalDC++;

        // Insert English translations
        for (const t of enTrans) {
          const audio = audioMap[date]?.en?.[t.code] || {};
          await conn.query(
            `INSERT INTO daily_content_translations (daily_content_id, translation_code, translated_text, chapter_text, verse_reference, audio_url, audio_srt_url, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'database')`,
            [dcId, t.code, t.verseText, t.chapterText || null, t.verseRef, audio.audioUrl || null, audio.srtUrl || null]
          );
          totalTrans++;
        }

        console.log(`${date} Bible EN: id=${dcId}, ${enTrans.length} trans, ref=${verseRef}`);
      }

      // ════════════════ BIBLE SPANISH ════════════════
      if (bibleData?.es?.length > 0) {
        const esTrans = bibleData.es.filter(t => !t.isFreeLuma);
        const esFreeLuma = bibleData.es.find(t => t.isFreeLuma);
        const kjvEs = esTrans.find(t => t.code === 'KJV');
        const contentText = esFreeLuma?.verseText || kjvEs?.verseText || esTrans[0]?.verseText || '';
        const verseRef = esFreeLuma?.verseRef || kjvEs?.verseRef || esTrans[0]?.verseRef || '';
        const chapterRef = extractChapterRef(verseRef);
        const bgUrl = videos?.bible?.es?.bg || videos?.bible?.en?.bg || '';
        const dailyUrl = videos?.bible?.es?.daily || null;

        const [res] = await conn.query(
          `INSERT INTO daily_content (post_date, mode, title, content_text, verse_reference, chapter_reference, video_background_url, lumashort_video_url, language, published) VALUES (?, 'bible', 'Versículo del Día', ?, ?, ?, ?, ?, 'es', 1)`,
          [date, contentText, verseRef, chapterRef, bgUrl, dailyUrl]
        );
        const dcId = res.insertId;
        totalDC++;

        // Insert Spanish translations
        for (const t of esTrans) {
          const audio = audioMap[date]?.es?.[t.code] || {};
          await conn.query(
            `INSERT INTO daily_content_translations (daily_content_id, translation_code, translated_text, chapter_text, verse_reference, audio_url, audio_srt_url, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'database')`,
            [dcId, t.code, t.verseText, t.chapterText || null, t.verseRef, audio.audioUrl || null, audio.srtUrl || null]
          );
          totalTrans++;
        }

        console.log(`${date} Bible ES: id=${dcId}, ${esTrans.length} trans, ref=${verseRef}`);
      }

      // NOTE: Positivity rows and FREELUMA translations are excluded per user request.
      // Only Bible content with standard Bible translation codes is inserted.
    }

    console.log(`\n=== Inserted ${totalDC} daily_content rows, ${totalTrans} translation rows ===\n`);

    // ── Verify ──
    console.log('Verification:');
    const [verify] = await conn.query(
      `SELECT id, post_date, mode, language, verse_reference, LEFT(content_text, 60) as preview FROM daily_content WHERE post_date BETWEEN ? AND ? ORDER BY post_date, mode, language`,
      [DATE_START, DATE_END]
    );
    for (const r of verify) {
      const d = r.post_date instanceof Date ? r.post_date.toISOString().slice(0, 10) : String(r.post_date).slice(0, 10);
      console.log(`  ${d} ${r.mode.padEnd(11)} ${r.language} id=${String(r.id).padEnd(4)} ref=${(r.verse_reference || '-').padEnd(25)} "${r.preview}..."`);
    }

    const vIds = verify.map(r => r.id);
    if (vIds.length > 0) {
      const [vTrans] = await conn.query(
        `SELECT daily_content_id, COUNT(*) as cnt, SUM(audio_url IS NOT NULL) as audio, SUM(audio_srt_url IS NOT NULL) as srt FROM daily_content_translations WHERE daily_content_id IN (?) GROUP BY daily_content_id`,
        [vIds]
      );
      console.log(`\n  Translations per row:`);
      for (const r of vTrans) {
        console.log(`    dc_id=${r.daily_content_id}: ${r.cnt} trans, ${r.audio} audio, ${r.srt} SRT`);
      }
    }

    console.log('\n=== COMPLETE ===');
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
