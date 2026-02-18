import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'freeluma_dev',
});

// Show current pending
const [rows] = await conn.query("SELECT `value` FROM platform_settings WHERE `key` = 'heygen_pending_videos'");
if (rows.length > 0 && rows[0].value) {
  const pending = JSON.parse(rows[0].value);
  console.log(`Found ${Object.keys(pending).length} pending entries:`);
  for (const [vid, info] of Object.entries(pending)) {
    console.log(`  ${vid} → content ${info.dailyContentId} (${info.creatorName}, ${info.triggeredAt})`);
  }
} else {
  console.log('No pending entries found');
}

// Clear them
await conn.query("UPDATE platform_settings SET `value` = '{}' WHERE `key` = 'heygen_pending_videos'");
console.log('\nCleared all pending entries.');

await conn.end();
