import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'freeluma_dev',
});

const [result] = await conn.query(
  "UPDATE daily_content SET meditation_script = NULL WHERE mode = 'positivity' AND post_date >= '2026-03-10'"
);
console.log(`Rows updated: ${result.changedRows}`);
await conn.end();
