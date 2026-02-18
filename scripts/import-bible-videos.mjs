#!/usr/bin/env node
/**
 * Download bible videos from freelumaquotes.com and upload to B2.
 * Updates daily_content.lumashort_video_url for ALL bible entries (overwrites existing).
 *
 * Usage: node scripts/import-bible-videos.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';

const BASE_URL = 'https://www.freelumaquotes.com/freeluma/bible/resources';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'freeluma_dev',
});

const b2 = new S3Client({
  endpoint: `https://s3.${process.env.B2_REGION}.backblazeb2.com`,
  region: process.env.B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const BUCKET = process.env.B2_BUCKET_NAME;
const CDN = process.env.CDN_BASE_URL || `https://f005.backblazeb2.com/file/${BUCKET}`;

// Get all unique dates for bible entries (overwrite all)
const [rows] = await conn.query(
  `SELECT DISTINCT DATE_FORMAT(post_date, '%Y-%m-%d') AS d
   FROM daily_content
   WHERE mode = 'bible'
     AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
   ORDER BY d`
);

const dates = rows.map(r => r.d);
console.log(`Found ${dates.length} dates with bible entries (will overwrite all)\n`);

let success = 0;
let failed = 0;

for (const date of dates) {
  const url = `${BASE_URL}/${date}.mp4`;

  // 1. Try to download
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.log(`[${date}] FAIL — network error: ${err.message}`);
    failed++;
    continue;
  }

  if (!res.ok) {
    console.log(`[${date}] SKIP — HTTP ${res.status} (no video on remote)`);
    failed++;
    continue;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const sizeMB = (buf.byteLength / 1024 / 1024).toFixed(1);

  // 2. Upload to B2
  const key = `daily-videos/bible/${date}.mp4`;
  try {
    await b2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buf,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  } catch (err) {
    console.log(`[${date}] FAIL — B2 upload error: ${err.message}`);
    failed++;
    continue;
  }

  const publicUrl = `${CDN}/${key}`;

  // 3. Update ALL bible rows for this date (overwrite existing)
  const [result] = await conn.query(
    `UPDATE daily_content
     SET lumashort_video_url = ?
     WHERE mode = 'bible'
       AND DATE_FORMAT(post_date, '%Y-%m-%d') = ?`,
    [publicUrl, date]
  );

  console.log(`[${date}] SUCCESS — ${sizeMB} MB → B2, ${result.changedRows} row(s) updated`);
  success++;
}

console.log(`\nDone: ${success} success, ${failed} failed/skipped out of ${dates.length} dates`);
await conn.end();
