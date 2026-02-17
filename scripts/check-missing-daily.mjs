#!/usr/bin/env node
/**
 * Check for missing daily_content dates and missing translations
 * for Jan 1 - Mar 31, 2026.
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev',
});

// 1. Get all existing daily_content
const [existing] = await conn.query(
  `SELECT id, post_date, mode, language FROM daily_content WHERE post_date BETWEEN '2026-01-01' AND '2026-03-31' ORDER BY post_date, language`
);

const dateMap = {};
for (const r of existing) {
  const d = r.post_date instanceof Date ? r.post_date.toISOString().slice(0, 10) : String(r.post_date).slice(0, 10);
  if (!dateMap[d]) dateMap[d] = {};
  dateMap[d][r.language] = { id: r.id, mode: r.mode };
}

// 2. Find missing dates (Jan 1 - Mar 31)
console.log('=== MISSING DAILY_CONTENT DATES ===\n');
const missingDates = [];
const start = new Date('2026-01-01T00:00:00');
const end = new Date('2026-03-31T00:00:00');
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  const ds = d.toISOString().slice(0, 10);
  const hasEn = dateMap[ds]?.en;
  const hasEs = dateMap[ds]?.es;
  if (!hasEn || !hasEs) {
    const missing = [];
    if (!hasEn) missing.push('en');
    if (!hasEs) missing.push('es');
    missingDates.push({ date: ds, missing });
  }
}

console.log(`Date Range: 2026-01-01 to 2026-03-31 (90 days)`);
console.log(`Dates with content: ${Object.keys(dateMap).length}`);
console.log(`Dates missing content: ${missingDates.length}\n`);

for (const m of missingDates) {
  console.log(`  ${m.date}  missing: ${m.missing.join(', ')}`);
}

// 3. Get bible_translations from our system
const [bibleTranslations] = await conn.query(
  `SELECT code, name, language FROM bible_translations WHERE active = 1 ORDER BY language, code`
);

console.log('\n=== ACTIVE BIBLE TRANSLATIONS ===\n');
const enCodes = bibleTranslations.filter(t => t.language === 'en').map(t => t.code);
const esCodes = bibleTranslations.filter(t => t.language === 'es').map(t => t.code);
console.log(`English (${enCodes.length}): ${enCodes.join(', ')}`);
console.log(`Spanish (${esCodes.length}): ${esCodes.join(', ')}`);

// 4. Check which translations are missing per daily_content row
const [allTranslations] = await conn.query(
  `SELECT daily_content_id, translation_code FROM daily_content_translations WHERE daily_content_id IN (?)`,
  [existing.map(r => r.id)]
);

const transMap = {};
for (const t of allTranslations) {
  if (!transMap[t.daily_content_id]) transMap[t.daily_content_id] = new Set();
  transMap[t.daily_content_id].add(t.translation_code);
}

console.log('\n=== MISSING TRANSLATIONS PER DAILY_CONTENT ===\n');
const missingTrans = [];

for (const r of existing) {
  if (r.mode !== 'bible') continue; // Only bible mode has translations
  const d = r.post_date instanceof Date ? r.post_date.toISOString().slice(0, 10) : String(r.post_date).slice(0, 10);
  const existingCodes = transMap[r.id] || new Set();
  const expectedCodes = r.language === 'en' ? enCodes : esCodes;
  const missing = expectedCodes.filter(c => !existingCodes.has(c));

  if (missing.length > 0) {
    missingTrans.push({ date: d, lang: r.language, dcId: r.id, existing: [...existingCodes].sort(), missing });
    console.log(`  ${d} (${r.language}) id=${r.id}  has: [${[...existingCodes].sort().join(',')}]  missing: [${missing.join(',')}]`);
  }
}

if (missingTrans.length === 0) {
  console.log('  All rows have complete translations!');
}

// Summary
console.log('\n=== SUMMARY ===\n');
console.log(`Missing dates (no daily_content): ${missingDates.filter(m => m.missing.includes('en') && m.missing.includes('es')).length} fully missing, ${missingDates.filter(m => !(m.missing.includes('en') && m.missing.includes('es'))).length} partially missing`);
console.log(`Daily content rows missing translations: ${missingTrans.length}`);
console.log(`Total missing translation entries: ${missingTrans.reduce((sum, m) => sum + m.missing.length, 0)}`);

await conn.end();
