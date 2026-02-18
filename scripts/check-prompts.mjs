import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'freeluma_dev',
});

// Count missing
const [missing] = await conn.query(`
  SELECT
    SUM(background_prompt IS NULL OR background_prompt = '') as missing_bg,
    SUM(camera_script IS NULL OR camera_script = '') as missing_script,
    SUM((background_prompt IS NULL OR background_prompt = '') AND (camera_script IS NULL OR camera_script = '')) as missing_both,
    COUNT(*) as total
  FROM daily_content
  WHERE mode = 'positivity' AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
`);
console.log('=== MISSING COUNTS ===');
console.log(`Total rows: ${missing[0].total}`);
console.log(`Missing background_prompt: ${missing[0].missing_bg}`);
console.log(`Missing camera_script: ${missing[0].missing_script}`);
console.log(`Missing both: ${missing[0].missing_both}`);

// Show a few that HAVE values for reference
const [examples] = await conn.query(`
  SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') as d, language,
         LEFT(background_prompt, 200) as bg, LEFT(camera_script, 200) as script
  FROM daily_content
  WHERE mode = 'positivity' AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
    AND background_prompt IS NOT NULL AND background_prompt != ''
  LIMIT 4
`);
console.log('\n=== EXAMPLES WITH background_prompt ===');
for (const r of examples) {
  console.log(`\n--- ${r.d} (${r.language}) ---`);
  console.log(`BG: ${r.bg}`);
  console.log(`SCRIPT: ${r.script || '(empty)'}`);
}

const [scriptExamples] = await conn.query(`
  SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') as d, language,
         LEFT(camera_script, 300) as script
  FROM daily_content
  WHERE mode = 'positivity' AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
    AND camera_script IS NOT NULL AND camera_script != ''
  LIMIT 4
`);
console.log('\n=== EXAMPLES WITH camera_script ===');
for (const r of scriptExamples) {
  console.log(`\n--- ${r.d} (${r.language}) ---`);
  console.log(`SCRIPT: ${r.script}`);
}

// Also check the SoraPrompt from old DB for reference
console.log('\n=== OLD DB SoraPrompt SAMPLES ===');
const fs = await import('fs');
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

let shown = 0;
for (const val of allValues) {
  const f = parseRow(val);
  const date = f[1];
  const cat = f[2];
  const lang = f[7];
  const soraPrompt = f[8] === 'NULL' ? null : f[8];
  if (cat?.toLowerCase() === 'positivity' && date >= '2026-02-01' && date <= '2026-03-31' && soraPrompt && lang === 'English' && shown < 5) {
    console.log(`\n--- ${date} ---`);
    console.log(soraPrompt.substring(0, 300));
    shown++;
  }
}

await conn.end();
