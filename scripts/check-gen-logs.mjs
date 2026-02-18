import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'freeluma_dev',
});

const [rows] = await conn.query(`
  SELECT id, daily_content_id, field, status, error_message, duration_ms, created_at
  FROM content_generation_logs
  WHERE field = 'heygen_video'
  ORDER BY created_at DESC
  LIMIT 10
`);

console.log('=== HeyGen Generation Logs ===\n');
for (const r of rows) {
  console.log(`Log #${r.id} | content=${r.daily_content_id} | status=${r.status} | ${r.duration_ms}ms | ${r.created_at}`);
  if (r.error_message) console.log(`  ERROR: ${r.error_message}`);
}

// Also check what voice_id the creators have
const [creators] = await conn.query(`
  SELECT id, name, is_ai, heygen_avatar_id, heygen_voice_id
  FROM luma_short_creators WHERE is_ai = 1
`);
console.log('\n=== AI Creators ===\n');
for (const c of creators) {
  console.log(`ID ${c.id}: ${c.name} | avatar=${c.heygen_avatar_id} | voice=${c.heygen_voice_id}`);
}

// Check pending
const [pending] = await conn.query("SELECT `value` FROM platform_settings WHERE `key` = 'heygen_pending_videos'");
if (pending.length > 0) {
  const map = JSON.parse(pending[0].value || '{}');
  console.log(`\n=== Pending Videos: ${Object.keys(map).length} ===\n`);
  for (const [vid, info] of Object.entries(map)) {
    console.log(`  ${vid} → content ${info.dailyContentId} (${info.creatorName})`);
  }
}

await conn.end();
