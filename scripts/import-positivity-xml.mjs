#!/usr/bin/env node
/**
 * Import positivity content from freelumaquotes.com XML files.
 *
 * For each daily_content row with mode='positivity' and empty content_text,
 * fetches the XML from the remote server and populates:
 *   - daily_content.content_text  ← <verse> (the daily quote)
 *   - daily_content.title         ← first 100 chars of quote
 *   - daily_content_translations (EN) translated_text ← <verse>
 *   - daily_content_translations (ES) translated_text ← <spanishScript> (if es row exists)
 *
 * Usage:
 *   node scripts/import-positivity-xml.mjs [--dry-run]
 *   DB_HOST=10.0.0.3 DB_USER=freeluma_app DB_PASS='...' DB_NAME=freeluma_prod node scripts/import-positivity-xml.mjs
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'freeluma_dev',
});

const XML_BASE = 'https://www.freelumaquotes.com/freeluma/positivity/resources';

function formatDate(d) {
  if (typeof d === 'string') return d.slice(0, 10);
  // Date object — format as YYYY-MM-DD in UTC
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const m = xml.match(re);
  return m ? decodeHtmlEntities(m[1].trim()) : null;
}

// Get all positivity rows with empty content_text
const [rows] = await conn.query(
  "SELECT id, post_date, language FROM daily_content WHERE mode = 'positivity' AND (content_text IS NULL OR content_text = '') ORDER BY post_date, language"
);

console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Found ${rows.length} positivity rows with empty content_text\n`);

// Group by date so we fetch each XML once
const byDate = {};
for (const row of rows) {
  const dateStr = formatDate(row.post_date);
  if (!byDate[dateStr]) byDate[dateStr] = {};
  byDate[dateStr][row.language] = row;
}

const dates = Object.keys(byDate).sort();
let updated = 0;
let translationsUpserted = 0;
let xmlFailed = 0;
let xmlCached = {};

for (const date of dates) {
  // Fetch XML (once per date)
  if (!xmlCached[date]) {
    const url = `${XML_BASE}/${date}.xml`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`  ${date}: XML ${res.status} — skipped`);
        xmlFailed++;
        continue;
      }
      xmlCached[date] = await res.text();
    } catch (err) {
      console.log(`  ${date}: fetch error — ${err.message}`);
      xmlFailed++;
      continue;
    }
  }

  const xml = xmlCached[date];
  const verse = extractTag(xml, 'verse');
  const spanishScript = extractTag(xml, 'spanishScript');

  if (!verse) {
    console.log(`  ${date}: no <verse> in XML — skipped`);
    continue;
  }

  const title = verse.substring(0, 100);

  for (const lang of ['en', 'es']) {
    const row = byDate[date][lang];
    if (!row) continue;

    // Determine the text for this language
    const text = lang === 'es' && spanishScript ? spanishScript : verse;
    const translationCode = lang === 'en' ? 'EN' : 'ES';

    if (!DRY_RUN) {
      // Update daily_content row
      await conn.query(
        'UPDATE daily_content SET content_text = ?, title = ? WHERE id = ?',
        [text, lang === 'en' ? title : (spanishScript || verse).substring(0, 100), row.id]
      );

      // Upsert translation row
      await conn.query(
        `INSERT INTO daily_content_translations (daily_content_id, translation_code, translated_text, source, created_at, updated_at)
         VALUES (?, ?, ?, 'database', NOW(), NOW())
         ON DUPLICATE KEY UPDATE translated_text = VALUES(translated_text), source = 'database', updated_at = NOW()`,
        [row.id, translationCode, text]
      );
      translationsUpserted++;
    }
    updated++;
  }

  if (dates.indexOf(date) % 20 === 0 || date === dates[dates.length - 1]) {
    process.stdout.write(`  Progress: ${date} (${updated} updated)\r`);
  }
}

console.log(`\n\n${'='.repeat(50)}`);
console.log(`IMPORT COMPLETE${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log(`${'='.repeat(50)}`);
console.log(`Content rows updated:    ${updated}`);
console.log(`Translation rows upserted: ${translationsUpserted}`);
console.log(`XML fetch failures:      ${xmlFailed}`);

// Verify
if (!DRY_RUN) {
  const [remaining] = await conn.query(
    "SELECT COUNT(*) as cnt FROM daily_content WHERE mode = 'positivity' AND (content_text IS NULL OR content_text = '')"
  );
  console.log(`\nRemaining empty positivity rows: ${remaining[0].cnt}`);
}

await conn.end();
