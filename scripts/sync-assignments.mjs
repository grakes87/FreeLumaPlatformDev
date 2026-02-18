#!/usr/bin/env node
/**
 * Sync positivity creator assignments from old freelumacontent DB dump
 * into the new freeluma_dev.daily_content table.
 *
 * Maps old AssignedVideoScript names → new luma_short_creators IDs.
 * Updates creator_id and status='assigned' for Feb-Mar 2026 positivity rows.
 */

import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

// --- Name mapping: old DB name → new luma_short_creators.id ---
const NAME_MAP = {
  'Sam':            6,  // Sam W.
  'Daniel':         1,  // Daniel Strain
  'Falynne':        2,  // Falynne Smith
  'Jeremy':         3,  // Jeremy Davis
  'Rebecca':        4,  // Rebecca Klein
  'Angelo':         5,  // Angelo Z.
  'AI-Gary Rakes':  7,  // Gary R.
  'AI-Viktoria':    8,  // Viktoria B.
};

// --- Language mapping ---
const LANG_MAP = {
  'English': 'en',
  'Spanish': 'es',
};

// --- Parse old DB dump ---
const data = fs.readFileSync('Old Database/freelumacontent-1.sql', 'utf8');

const insertRegex = /INSERT INTO [`"]?dailyposts[`"]?\s+(?:\([^)]+\)\s+)?VALUES\s*([\s\S]*?);\s*$/gim;
let insertMatch;
const allValues = [];

while ((insertMatch = insertRegex.exec(data)) !== null) {
  const valuesBlock = insertMatch[1];
  let depth = 0, current = '', inStr = false, escapeNext = false;
  for (let i = 0; i < valuesBlock.length; i++) {
    const ch = valuesBlock[i];
    if (escapeNext) { current += ch; escapeNext = false; continue; }
    if (ch === '\\') { current += ch; escapeNext = true; continue; }
    if (ch === "'" && !escapeNext) { inStr = !inStr; current += ch; continue; }
    if (inStr) { current += ch; continue; }
    if (ch === '(') { depth++; if (depth === 1) { current = ''; continue; } }
    if (ch === ')') { depth--; if (depth === 0) { allValues.push(current); current = ''; continue; } }
    current += ch;
  }
}

function parseRow(str) {
  const fields = [];
  let current = '', inStr = false, escapeNext = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escapeNext) { current += ch; escapeNext = false; continue; }
    if (ch === '\\') { escapeNext = true; continue; }
    if (ch === "'" && !escapeNext) { inStr = !inStr; continue; }
    if (ch === ',' && !inStr) { fields.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

// Filter positivity Feb-Mar 2026 assignments
const assignments = [];
for (const val of allValues) {
  const f = parseRow(val);
  // Columns: Id, PostDate, Category, AssignedMeditation, AssignedVideoScript, ...Language(7)...
  const date = f[1];
  const category = f[2];
  const videoCreator = f[4] === 'NULL' || f[4] === 'None' ? null : f[4];
  const language = f[7];

  if (category?.toLowerCase() === 'positivity' && date >= '2026-02-01' && date <= '2026-03-31' && videoCreator) {
    const creatorId = NAME_MAP[videoCreator];
    const lang = LANG_MAP[language];
    if (creatorId && lang) {
      assignments.push({ date, lang, creatorName: videoCreator, creatorId });
    } else {
      console.log(`WARNING: unmapped creator="${videoCreator}" or language="${language}" for ${date}`);
    }
  }
}

console.log(`Parsed ${assignments.length} positivity assignments from old DB\n`);

// --- Connect to new DB and sync ---
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'freeluma_dev',
});

let updated = 0, skipped = 0, notFound = 0;

for (const a of assignments) {
  const [rows] = await conn.query(
    `SELECT id, creator_id, status FROM daily_content
     WHERE mode = 'positivity' AND DATE_FORMAT(post_date, '%Y-%m-%d') = ? AND language = ?`,
    [a.date, a.lang]
  );

  if (rows.length === 0) {
    console.log(`[${a.date}] ${a.lang} — NOT FOUND in daily_content`);
    notFound++;
    continue;
  }

  const row = rows[0];

  // Update creator_id and set status to 'assigned' if currently empty
  const newStatus = row.status === 'empty' ? 'assigned' : row.status;
  const [result] = await conn.query(
    `UPDATE daily_content SET creator_id = ?, status = ? WHERE id = ?`,
    [a.creatorId, newStatus, row.id]
  );

  if (result.changedRows > 0) {
    console.log(`[${a.date}] ${a.lang} — SET creator=${a.creatorId} (${a.creatorName}), status=${newStatus}`);
    updated++;
  } else {
    console.log(`[${a.date}] ${a.lang} — already creator=${row.creator_id}, status=${row.status} (no change)`);
    skipped++;
  }
}

console.log(`\n=== SYNC COMPLETE ===`);
console.log(`Updated: ${updated}`);
console.log(`Already correct: ${skipped}`);
console.log(`Not found: ${notFound}`);

// Show final stats
const [finalStats] = await conn.query(`
  SELECT language, status, creator_id, COUNT(*) as cnt
  FROM daily_content
  WHERE mode = 'positivity' AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
  GROUP BY language, status, creator_id
  ORDER BY language, status, creator_id
`);
console.log('\n=== FINAL STATE ===');
for (const r of finalStats) {
  console.log(`  lang=${r.language} status=${r.status} creator_id=${r.creator_id} count=${r.cnt}`);
}

await conn.end();
