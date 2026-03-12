/**
 * Boost daily content reactions to 100-300 per verse using existing AI seed users.
 * Targets bible mode, Feb 21-28 2026.
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '10.0.0.3',
  user: 'freeluma_app',
  password: 'FL!pr0d#X8kM2vR7nQ4wJ9sT3yB6cH1',
  database: 'freeluma_prod',
});

const CONTENT_IDS = [730, 732, 734, 736, 738, 740, 742, 744];
const DATES = ['02-21','02-22','02-23','02-24','02-25','02-26','02-27','02-28'];
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

let totalAdded = 0;

for (let i = 0; i < CONTENT_IDS.length; i++) {
  const contentId = CONTENT_IDS[i];

  // Check how many reactions already exist
  const [existing] = await conn.query(
    'SELECT COUNT(*) as cnt FROM daily_reactions WHERE daily_content_id = ?', [contentId]
  );
  const currentCount = existing[0].cnt;

  // Target 100-300 total
  const target = randomInt(100, 300);
  const needed = Math.max(0, target - currentCount);

  if (needed === 0) {
    console.log(`${DATES[i]}: already at ${currentCount}, target ${target} — skipping`);
    continue;
  }

  // Get user IDs that haven't reacted yet
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
      const type = randomFrom(REACTION_TYPES);
      values.push('(?, ?, ?, NOW(), NOW())');
      params.push(userId, contentId, type);
    }

    const [result] = await conn.query(
      `INSERT IGNORE INTO daily_reactions (user_id, daily_content_id, reaction_type, created_at, updated_at) VALUES ${values.join(',')}`,
      params
    );
    totalAdded += result.affectedRows;
    console.log(`${DATES[i]}: ${currentCount} -> ${currentCount + result.affectedRows} (target: ${target})`);
  }
}

console.log(`\nTotal reactions added: ${totalAdded}`);
await conn.end();
