#!/usr/bin/env node
/**
 * Download positivity audio (.mp3) and background videos (-background.mp4)
 * from freelumaquotes.com, upload to B2, and update daily_content.
 *
 * Usage: node scripts/import-positivity-assets.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';

const BASE_URL = 'https://www.freelumaquotes.com/freeluma/positivity/resources';

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

// Get all unique dates for positivity entries
const [rows] = await conn.query(
  `SELECT DISTINCT DATE_FORMAT(post_date, '%Y-%m-%d') AS d
   FROM daily_content
   WHERE mode = 'positivity'
     AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
   ORDER BY d`
);

const dates = rows.map(r => r.d);
console.log(`Found ${dates.length} positivity dates to process\n`);

// --- PASS 1: Audio (.mp3) → meditation_audio_url ---
console.log('=== AUDIO (.mp3) → meditation_audio_url ===\n');
let audioSuccess = 0, audioSkip = 0;

for (const date of dates) {
  const url = `${BASE_URL}/${date}.mp3`;

  let res;
  try { res = await fetch(url); } catch (err) {
    console.log(`[${date}] FAIL — network error: ${err.message}`);
    audioSkip++; continue;
  }

  if (!res.ok) {
    console.log(`[${date}] SKIP — HTTP ${res.status}`);
    audioSkip++; continue;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const sizeMB = (buf.byteLength / 1024 / 1024).toFixed(1);

  const key = `daily-audio/positivity/${date}.mp3`;
  try {
    await b2.send(new PutObjectCommand({
      Bucket: BUCKET, Key: key, Body: buf,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  } catch (err) {
    console.log(`[${date}] FAIL — B2 upload: ${err.message}`);
    audioSkip++; continue;
  }

  const publicUrl = `${CDN}/${key}`;
  const [result] = await conn.query(
    `UPDATE daily_content SET meditation_audio_url = ?
     WHERE mode = 'positivity' AND DATE_FORMAT(post_date, '%Y-%m-%d') = ?`,
    [publicUrl, date]
  );

  console.log(`[${date}] SUCCESS — ${sizeMB} MB, ${result.changedRows} row(s)`);
  audioSuccess++;
}

console.log(`\nAudio done: ${audioSuccess} success, ${audioSkip} skipped\n`);

// --- PASS 2: Background video (-background.mp4) → video_background_url ---
console.log('=== BACKGROUND (-background.mp4) → video_background_url ===\n');
let bgSuccess = 0, bgSkip = 0;

for (const date of dates) {
  const url = `${BASE_URL}/${date}-background.mp4`;

  let res;
  try { res = await fetch(url); } catch (err) {
    console.log(`[${date}] FAIL — network error: ${err.message}`);
    bgSkip++; continue;
  }

  if (!res.ok) {
    console.log(`[${date}] SKIP — HTTP ${res.status}`);
    bgSkip++; continue;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const sizeMB = (buf.byteLength / 1024 / 1024).toFixed(1);

  const key = `daily-videos/positivity-bg/${date}-background.mp4`;
  try {
    await b2.send(new PutObjectCommand({
      Bucket: BUCKET, Key: key, Body: buf,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  } catch (err) {
    console.log(`[${date}] FAIL — B2 upload: ${err.message}`);
    bgSkip++; continue;
  }

  const publicUrl = `${CDN}/${key}`;
  const [result] = await conn.query(
    `UPDATE daily_content SET video_background_url = ?
     WHERE mode = 'positivity' AND DATE_FORMAT(post_date, '%Y-%m-%d') = ?`,
    [publicUrl, date]
  );

  console.log(`[${date}] SUCCESS — ${sizeMB} MB, ${result.changedRows} row(s)`);
  bgSuccess++;
}

console.log(`\nBackground done: ${bgSuccess} success, ${bgSkip} skipped`);
console.log(`\nTOTAL: Audio ${audioSuccess}/${dates.length}, Background ${bgSuccess}/${dates.length}`);
await conn.end();
