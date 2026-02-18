import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'freeluma_dev',
});

// Show all heygen logs
const [all] = await conn.query(
  "SELECT id, daily_content_id, status, error_message, created_at FROM content_generation_logs WHERE field = 'heygen_video' ORDER BY id"
);
console.log('All heygen_video logs:');
for (const r of all) {
  console.log(`  #${r.id} content=${r.daily_content_id} status=${r.status} err=${r.error_message || '(none)'}`);
}

// Delete all failed/stale heygen logs
const [result] = await conn.query(
  "DELETE FROM content_generation_logs WHERE field = 'heygen_video' AND status = 'failed'"
);
console.log(`\nDeleted ${result.affectedRows} failed heygen logs`);

// Also clear pending videos map
await conn.query("UPDATE platform_settings SET `value` = '{}' WHERE `key` = 'heygen_pending_videos'");
console.log('Cleared pending videos map');

// Show remaining
const [remaining] = await conn.query(
  "SELECT id, daily_content_id, status, error_message FROM content_generation_logs WHERE field = 'heygen_video' ORDER BY id"
);
console.log('\nRemaining heygen logs:');
for (const r of remaining) {
  console.log(`  #${r.id} content=${r.daily_content_id} status=${r.status}`);
}

await conn.end();
