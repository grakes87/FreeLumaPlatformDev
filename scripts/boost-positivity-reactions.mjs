/**
 * Seed 30-60 reactions on each published positivity daily content
 * using existing AI seed users.
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

const REACTION_TYPES = ['like', 'love', 'wow', 'pray'];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Get all AI seed user IDs
const [users] = await conn.query(
  "SELECT id FROM users WHERE email LIKE ?", ['%@ai-seed.freeluma.internal']
);
const userIds = users.map(u => u.id);
console.log(`AI users available: ${userIds.length}`);

// Get all published positivity content
const [contentRows] = await conn.query(
  "SELECT id, post_date, language FROM daily_content WHERE mode = 'positivity' AND published = 1 AND post_date <= '2026-02-28' ORDER BY post_date, language"
);
console.log(`Positivity content rows: ${contentRows.length}\n`);

let totalAdded = 0;

for (const row of contentRows) {
  const contentId = row.id;
  const label = `${row.post_date} (${row.language})`;

  // Check existing reactions
  const [existing] = await conn.query(
    'SELECT COUNT(*) as cnt FROM daily_reactions WHERE daily_content_id = ?', [contentId]
  );
  const currentCount = existing[0].cnt;

  // Target 30-60 total
  const target = randomInt(30, 60);
  const needed = Math.max(0, target - currentCount);

  if (needed === 0) {
    console.log(`  ${label}: already at ${currentCount} — skipping`);
    continue;
  }

  // Get users that haven't reacted yet
  const [alreadyReacted] = await conn.query(
    'SELECT user_id FROM daily_reactions WHERE daily_content_id = ?', [contentId]
  );
  const reactedSet = new Set(alreadyReacted.map(r => r.user_id));
  const available = userIds.filter(id => !reactedSet.has(id));
  const toAdd = shuffle(available).slice(0, needed);

  if (toAdd.length > 0) {
    const values = [];
    const params = [];
    for (const userId of toAdd) {
      values.push('(?, ?, ?, NOW(), NOW())');
      params.push(userId, contentId, randomFrom(REACTION_TYPES));
    }

    const [result] = await conn.query(
      `INSERT IGNORE INTO daily_reactions (user_id, daily_content_id, reaction_type, created_at, updated_at) VALUES ${values.join(',')}`,
      params
    );
    totalAdded += result.affectedRows;
    console.log(`  ${label}: ${currentCount} -> ${currentCount + result.affectedRows} (target: ${target})`);
  }
}

console.log(`\nTotal reactions added: ${totalAdded}`);
await conn.end();
