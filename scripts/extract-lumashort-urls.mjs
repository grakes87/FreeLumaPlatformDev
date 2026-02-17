#!/usr/bin/env node
/**
 * Extract DailyPostVideoUrl (LumaShort) from old freelumamedia.sql
 * for February 2026 Spanish entries.
 */
import fs from 'fs';

const sql = fs.readFileSync('Old Database/freelumamedia.sql', 'utf-8');

// Extract all INSERT statements for dailyposts
const insertRegex = /INSERT INTO `dailyposts`[^;]+;/gs;
const matches = sql.match(insertRegex) || [];

const rows = [];
for (const stmt of matches) {
  const valuesMatch = stmt.match(/VALUES\s*(.+);$/s);
  if (!valuesMatch) continue;

  const tuples = valuesMatch[1].match(/\((?:[^()']|'[^']*')*\)/g) || [];
  for (const tuple of tuples) {
    const fields = [];
    const fieldRegex = /(?:'((?:[^'\\]|\\.)*)'|NULL|(\d+))/g;
    let m;
    while ((m = fieldRegex.exec(tuple))) {
      if (m[1] !== undefined) fields.push(m[1]);
      else if (m[2] !== undefined) fields.push(m[2]);
      else fields.push(null);
    }

    if (fields.length >= 8) {
      const postDate = fields[1];
      const language = fields[3];

      // All February 2026 entries
      if (postDate && postDate.startsWith('2026-02')) {
        rows.push({
          id: fields[0],
          postDate,
          category: fields[2],
          language,
          bgVideoUrl: fields[4] || null,
          bgVideoKey: fields[5] || null,
          dailyPostVideoUrl: fields[6] || null,
          dailyPostVideoKey: fields[7] || null,
        });
      }
    }
  }
}

console.log(`February 2026 rows found: ${rows.length}\n`);

// Show all, highlighting Spanish with missing lumashort targets
const targets = ['2026-02-01', '2026-02-02', '2026-02-11', '2026-02-16', '2026-02-23', '2026-02-24'];
for (const r of rows) {
  const isTarget = r.language === 'Spanish' && targets.includes(r.postDate);
  const marker = isTarget ? ' <<<' : '';
  console.log(
    `${r.postDate} | ${r.language.padEnd(8)} | ${r.category.padEnd(12)} | ` +
    `video: ${r.dailyPostVideoUrl || 'NULL'}${marker}`
  );
}

// Output just the targets
console.log('\n=== Target rows (Spanish, missing in our DB) ===');
for (const r of rows.filter(r => r.language === 'Spanish' && targets.includes(r.postDate))) {
  console.log(JSON.stringify(r, null, 2));
}
