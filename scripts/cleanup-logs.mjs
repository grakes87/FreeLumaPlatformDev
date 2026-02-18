import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'freeluma_dev',
});

// Clean up stale 'started' logs that never completed (orphaned from earlier bugs)
const [result] = await conn.query(`
  UPDATE content_generation_logs
  SET status = 'failed', error_message = 'Stale — cleared during bugfix', duration_ms = 0
  WHERE field = 'heygen_video' AND status = 'started' AND id != 144
`);
console.log(`Cleaned up ${result.changedRows} stale heygen log entries`);

await conn.end();
