#!/usr/bin/env node
/**
 * Seed missing background_prompt and camera_script for positivity
 * Feb-Mar 2026 daily_content rows.
 *
 * - background_prompt: Uses old DB SoraPrompt where available,
 *   generic filler otherwise.
 * - camera_script: Generic filler for English rows only
 *   (Spanish rows are AI-generated and don't need scripts).
 */

import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

// --- Parse old DB SoraPrompts ---
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

// Build map: date+lang → SoraPrompt
const soraPrompts = {};
for (const val of allValues) {
  const f = parseRow(val);
  const date = f[1];
  const cat = f[2];
  const lang = f[7] === 'English' ? 'en' : f[7] === 'Spanish' ? 'es' : null;
  const soraPrompt = f[8] === 'NULL' ? null : f[8];

  if (cat?.toLowerCase() === 'positivity' && date >= '2026-02-01' && date <= '2026-03-31' && soraPrompt && lang) {
    // Strip leading/trailing quotes from the prompt
    let clean = soraPrompt.replace(/^"|"$/g, '').trim();
    soraPrompts[`${date}_${lang}`] = clean;
  }
}
console.log(`Parsed ${Object.keys(soraPrompts).length} SoraPrompts from old DB\n`);

// --- Connect to new DB ---
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'freeluma_dev',
});

const FILLER_BG = 'A serene, cinematic nature scene with soft golden light filtering through gentle clouds, peaceful and uplifting atmosphere';

const FILLER_SCRIPT = `Welcome to today's moment of positivity! Take a deep breath and let go of any tension you're carrying. Remember that every day is a fresh opportunity to grow, to learn, and to spread kindness. You are stronger than you think, and your presence in this world matters more than you know. Today, choose to see the beauty in the small things—a warm cup of coffee, a smile from a stranger, the way sunlight dances through the trees. These moments of gratitude can transform your entire outlook. So go out there and be the light someone needs today. You've got this!`;

// Get all positivity rows missing bg_prompt or camera_script
const [rows] = await conn.query(`
  SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') as d, language,
         background_prompt, camera_script
  FROM daily_content
  WHERE mode = 'positivity' AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
  ORDER BY post_date, language
`);

let bgUpdated = 0, scriptUpdated = 0;

for (const row of rows) {
  const updates = [];
  const params = [];

  // background_prompt: use old SoraPrompt if available, else filler
  if (!row.background_prompt || row.background_prompt === '') {
    const oldPrompt = soraPrompts[`${row.d}_${row.language}`];
    updates.push('background_prompt = ?');
    params.push(oldPrompt || FILLER_BG);
    bgUpdated++;
  }

  // camera_script: only for English rows (Spanish are AI-generated)
  if ((!row.camera_script || row.camera_script === '') && row.language === 'en') {
    updates.push('camera_script = ?');
    params.push(FILLER_SCRIPT);
    scriptUpdated++;
  }

  if (updates.length > 0) {
    params.push(row.id);
    await conn.query(`UPDATE daily_content SET ${updates.join(', ')} WHERE id = ?`, params);
    const what = updates.map(u => u.split(' = ')[0]).join(' + ');
    const src = soraPrompts[`${row.d}_${row.language}`] ? 'SoraPrompt' : 'filler';
    console.log(`[${row.d}] ${row.language} — ${what} (bg: ${src})`);
  }
}

console.log(`\n=== SEED COMPLETE ===`);
console.log(`background_prompt filled: ${bgUpdated}`);
console.log(`camera_script filled: ${scriptUpdated}`);

// Verify
const [verify] = await conn.query(`
  SELECT
    SUM(background_prompt IS NULL OR background_prompt = '') as missing_bg,
    SUM(camera_script IS NULL OR camera_script = '') as missing_script
  FROM daily_content
  WHERE mode = 'positivity' AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
`);
console.log(`\nRemaining missing: bg=${verify[0].missing_bg}, script=${verify[0].missing_script}`);
console.log('(Spanish rows intentionally have no camera_script)');

await conn.end();
