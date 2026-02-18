/**
 * Import video scripts from old FreeLuma XML feeds into the daily_content table's camera_script column.
 *
 * Sources:
 *   1. English Bible:     https://freelumaquotes.com/freeluma/bible/resources/{YYYY-MM-DD}.xml  -> <videoScript>
 *   2. Spanish Bible:     https://www.freelumaquotes.com/freeluma/bible/resources/{YYYY-MM-DD}.xml -> <spanishScript>
 *   3. English Positivity: https://www.freelumaquotes.com/freeluma/positivity/resources/{YYYY-MM-DD}.xml -> <videoScript>
 *
 * Only updates rows where camera_script IS NULL or empty string.
 * Date range: 2026-02-01 through the last post_date in daily_content.
 */

import mysql from 'mysql2/promise';

// ── helpers ────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Format a Date as YYYY-MM-DD */
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Extract content of a given XML tag from raw XML text. Returns null if missing/empty. */
function extractTag(xml, tagName) {
  const re = new RegExp(`<${tagName}>(.*?)</${tagName}>`, 's');
  const m = xml.match(re);
  if (!m || !m[1].trim()) return null;
  // Decode common XML entities
  let text = m[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    // Decode hex entities like &#x1F31F;
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
    })
    // Decode decimal entities like &#8220;
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ''; }
    });
  return text.trim() || null;
}

/** Fetch a URL, returning the body text or null on error/404. */
async function fetchXml(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ── feed definitions ───────────────────────────────────────────────
const FEEDS = [
  {
    label: 'EN Bible',
    mode: 'bible',
    language: 'en',
    urlTemplate: (date) => `https://freelumaquotes.com/freeluma/bible/resources/${date}.xml`,
    xmlTag: 'videoScript',
  },
  {
    label: 'ES Bible',
    mode: 'bible',
    language: 'es',
    urlTemplate: (date) => `https://www.freelumaquotes.com/freeluma/bible/resources/${date}.xml`,
    xmlTag: 'spanishScript',
  },
  {
    label: 'EN Positivity',
    mode: 'positivity',
    language: 'en',
    urlTemplate: (date) => `https://www.freelumaquotes.com/freeluma/positivity/resources/${date}.xml`,
    xmlTag: 'videoScript',
  },
];

// ── main ───────────────────────────────────────────────────────────
async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
    database: 'freeluma_dev',
  });

  // Determine date range: 2026-02-01 to max(post_date)
  const [[{ max_date }]] = await conn.query(
    'SELECT MAX(post_date) AS max_date FROM daily_content'
  );
  // Use noon UTC to avoid timezone-shift issues
  const startDate = new Date('2026-02-01T12:00:00Z');
  const endDate = new Date(new Date(max_date).toISOString().slice(0, 10) + 'T12:00:00Z');
  console.log(`Date range: ${fmt(startDate)} – ${fmt(endDate)}`);

  // Build list of all dates
  const dates = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dates.push(fmt(d));
  }
  console.log(`Total dates: ${dates.length}\n`);

  const stats = { updated: 0, skipped: 0, noXml: 0, noTag: 0, noRow: 0 };

  for (const dateStr of dates) {
    for (const feed of FEEDS) {
      // Check if a row exists and needs updating
      const [[row]] = await conn.query(
        `SELECT id, camera_script FROM daily_content
         WHERE post_date = ? AND mode = ? AND language = ?
         LIMIT 1`,
        [dateStr, feed.mode, feed.language]
      );

      if (!row) {
        stats.noRow++;
        continue; // no daily_content row for this date/mode/language
      }

      if (row.camera_script && row.camera_script.trim() !== '') {
        stats.skipped++;
        console.log(`  SKIP  ${dateStr} ${feed.label} — already has camera_script`);
        continue;
      }

      // Fetch XML
      const url = feed.urlTemplate(dateStr);
      const xml = await fetchXml(url);
      if (!xml) {
        stats.noXml++;
        // 404 or fetch error — skip silently
        continue;
      }

      // Extract tag
      const script = extractTag(xml, feed.xmlTag);
      if (!script) {
        stats.noTag++;
        // Tag missing or empty — skip silently
        continue;
      }

      // Update DB
      await conn.query(
        'UPDATE daily_content SET camera_script = ? WHERE id = ?',
        [script, row.id]
      );
      stats.updated++;
      console.log(`  OK    ${dateStr} ${feed.label} — ${script.length} chars`);

      await sleep(200);
    }
  }

  console.log('\n════════════════════════════════════');
  console.log('Import complete!');
  console.log(`  Updated:     ${stats.updated}`);
  console.log(`  Skipped:     ${stats.skipped} (already had data)`);
  console.log(`  No XML/404:  ${stats.noXml}`);
  console.log(`  No tag:      ${stats.noTag}`);
  console.log(`  No row:      ${stats.noRow}`);
  console.log('════════════════════════════════════');

  await conn.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
