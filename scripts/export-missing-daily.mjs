#!/usr/bin/env node
/**
 * Export missing daily_content dates and missing daily_content_translations
 * for 2026-01-01 through 2026-03-31, checked against active bible_translations.
 */
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev',
});

const DATE_START = '2026-01-01';
const DATE_END = '2026-03-31';

// 1. Get active bible_translations grouped by language
const [bibleTranslations] = await conn.query(
  `SELECT code, name, language FROM bible_translations WHERE active = 1 ORDER BY language, code`
);
const expectedByLang = { en: [], es: [] };
for (const t of bibleTranslations) {
  if (expectedByLang[t.language]) {
    expectedByLang[t.language].push(t.code);
  }
}

// 2. Get all daily_content rows
const [dcRows] = await conn.query(
  `SELECT id, post_date, mode, language, verse_reference, chapter_reference FROM daily_content WHERE post_date BETWEEN ? AND ? ORDER BY post_date, language`,
  [DATE_START, DATE_END]
);

// 3. Get all translations
const dcIds = dcRows.map(r => r.id);
const [transRows] = dcIds.length > 0
  ? await conn.query(
      `SELECT daily_content_id, translation_code FROM daily_content_translations WHERE daily_content_id IN (?)`,
      [dcIds]
    )
  : [[]];

const transMap = {};
for (const t of transRows) {
  if (!transMap[t.daily_content_id]) transMap[t.daily_content_id] = new Set();
  transMap[t.daily_content_id].add(t.translation_code);
}

// 4. Build date coverage map
const dateMap = {};
for (const r of dcRows) {
  const d = r.post_date instanceof Date ? r.post_date.toISOString().slice(0, 10) : String(r.post_date).slice(0, 10);
  if (!dateMap[d]) dateMap[d] = {};
  dateMap[d][r.language] = r;
}

// 5. Find missing dates
const missingDates = [];
for (let d = new Date(DATE_START + 'T00:00:00'); d <= new Date(DATE_END + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
  const ds = d.toISOString().slice(0, 10);
  const missingLangs = [];
  if (!dateMap[ds]?.en) missingLangs.push('en');
  if (!dateMap[ds]?.es) missingLangs.push('es');
  if (missingLangs.length > 0) {
    missingDates.push({ date: ds, missing_languages: missingLangs });
  }
}

// 6. Find missing translations
const missingTranslations = [];
for (const r of dcRows) {
  if (r.mode !== 'bible') continue;
  const d = r.post_date instanceof Date ? r.post_date.toISOString().slice(0, 10) : String(r.post_date).slice(0, 10);
  const existingCodes = transMap[r.id] || new Set();
  const expectedCodes = expectedByLang[r.language] || [];
  const missing = expectedCodes.filter(c => !existingCodes.has(c));
  if (missing.length > 0) {
    missingTranslations.push({
      date: d,
      language: r.language,
      daily_content_id: r.id,
      verse_reference: r.verse_reference,
      chapter_reference: r.chapter_reference,
      existing_translations: [...existingCodes].sort(),
      missing_translations: missing,
    });
  }
}

// 7. Build export
const output = {
  generated_at: new Date().toISOString(),
  date_range: { start: DATE_START, end: DATE_END },
  active_bible_translations: {
    en: expectedByLang.en,
    es: expectedByLang.es,
  },
  missing_daily_content_dates: missingDates,
  missing_translations: missingTranslations,
  summary: {
    total_dates_in_range: 90,
    dates_with_content: Object.keys(dateMap).length,
    dates_fully_missing: missingDates.filter(m => m.missing_languages.length === 2).length,
    dates_partially_missing: missingDates.filter(m => m.missing_languages.length === 1).length,
    daily_content_rows_missing_translations: missingTranslations.length,
    total_missing_translation_entries: missingTranslations.reduce((sum, m) => sum + m.missing_translations.length, 0),
  },
};

// Write JSON
const outPath = path.join(__dirname, '..', 'missing-daily-content-export.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

// Also write human-readable text
let txt = `MISSING DAILY CONTENT EXPORT\n`;
txt += `Generated: ${output.generated_at}\n`;
txt += `Date Range: ${DATE_START} to ${DATE_END}\n\n`;

txt += `=== ACTIVE BIBLE TRANSLATIONS ===\n`;
txt += `English (${expectedByLang.en.length}): ${expectedByLang.en.join(', ')}\n`;
txt += `Spanish (${expectedByLang.es.length}): ${expectedByLang.es.join(', ')}\n\n`;

txt += `=== MISSING DAILY_CONTENT DATES ===\n`;
if (missingDates.length === 0) {
  txt += `None — all dates in range have daily_content for both languages.\n\n`;
} else {
  for (const m of missingDates) {
    txt += `${m.date}  missing: ${m.missing_languages.join(', ')}\n`;
  }
  txt += `\n`;
}

txt += `=== MISSING TRANSLATIONS ===\n`;
txt += `Expected English translations: ${expectedByLang.en.join(', ')}\n`;
txt += `Expected Spanish translations: ${expectedByLang.es.join(', ')}\n\n`;

for (const m of missingTranslations) {
  txt += `${m.date} (${m.language}) dc_id=${m.daily_content_id}  ref: ${m.verse_reference || 'N/A'}  chapter: ${m.chapter_reference || 'N/A'}\n`;
  txt += `  Has:     [${m.existing_translations.join(', ')}]\n`;
  txt += `  Missing: [${m.missing_translations.join(', ')}]\n\n`;
}

txt += `=== SUMMARY ===\n`;
txt += `Total dates in range: ${output.summary.total_dates_in_range}\n`;
txt += `Dates with content: ${output.summary.dates_with_content}\n`;
txt += `Dates fully missing: ${output.summary.dates_fully_missing}\n`;
txt += `Dates partially missing: ${output.summary.dates_partially_missing}\n`;
txt += `Daily content rows missing translations: ${output.summary.daily_content_rows_missing_translations}\n`;
txt += `Total missing translation entries: ${output.summary.total_missing_translation_entries}\n`;

const txtPath = path.join(__dirname, '..', 'missing-daily-content-export.txt');
fs.writeFileSync(txtPath, txt);

console.log(txt);
console.log(`\nExported to:`);
console.log(`  ${outPath}`);
console.log(`  ${txtPath}`);

await conn.end();
