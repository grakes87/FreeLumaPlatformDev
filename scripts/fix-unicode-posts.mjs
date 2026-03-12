#!/usr/bin/env node
/**
 * Fix posts with raw U+XXXX unicode codepoints from legacy import.
 * Converts e.g. "U+2764U+FE0F" → "❤️"
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'freeluma_dev',
});

function decodeUnicodeCodes(text) {
  // Match sequences of U+XXXX (possibly multiple concatenated)
  return text.replace(/(?:U\+([0-9A-Fa-f]{4,6}))+/g, (match) => {
    const codepoints = [];
    const re = /U\+([0-9A-Fa-f]{4,6})/g;
    let m;
    while ((m = re.exec(match)) !== null) {
      codepoints.push(parseInt(m[1], 16));
    }
    try {
      return String.fromCodePoint(...codepoints);
    } catch {
      return match; // leave as-is if invalid
    }
  });
}

const [rows] = await conn.query("SELECT id, body FROM posts WHERE body LIKE '%U+%'");
console.log(`Found ${rows.length} posts with U+ codepoints\n`);

let updated = 0;
for (const row of rows) {
  const fixed = decodeUnicodeCodes(row.body);
  if (fixed !== row.body) {
    await conn.query('UPDATE posts SET body = ? WHERE id = ?', [fixed, row.id]);
    updated++;
  }
}

console.log(`Fixed: ${updated} posts`);

// Verify
const [remaining] = await conn.query("SELECT COUNT(*) as cnt FROM posts WHERE body LIKE '%U+%'");
console.log(`Remaining with U+: ${remaining[0].cnt}`);

await conn.end();
