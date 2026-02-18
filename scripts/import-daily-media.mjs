#!/usr/bin/env node
/**
 * Import daily media from freelumaquotes.com → B2 → database.
 *
 * Usage:
 *   node scripts/import-daily-media.mjs --mode positivity
 *   node scripts/import-daily-media.mjs --mode bible
 *   node scripts/import-daily-media.mjs --mode positivity --start 2026-04-01 --end 2026-04-30
 *
 * BIBLE mode downloads:
 *   {date}.mp4  → daily_content.lumashort_video_url
 *
 * POSITIVITY mode downloads:
 *   {date}.mp4             → daily_content.lumashort_video_url
 *   {date}.mp3             → daily_content.meditation_audio_url
 *   {date}.srt             → daily_content_translations.audio_srt_url (EN row, uploaded to B2)
 *   {date}-background.mp4  → daily_content.video_background_url
 *
 * All assets overwrite existing values. Dates with no remote file (404) are skipped.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';

// --- CLI args ---
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const MODE = getArg('mode');
if (!MODE || !['bible', 'positivity'].includes(MODE)) {
  console.error('Usage: node scripts/import-daily-media.mjs --mode <bible|positivity> [--start YYYY-MM-DD] [--end YYYY-MM-DD]');
  process.exit(1);
}

const START = getArg('start') || '2026-02-01';
const END   = getArg('end')   || '2026-03-31';

const BASE_URL = `https://www.freelumaquotes.com/freeluma/${MODE}/resources`;

// --- DB + B2 setup ---
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
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

// --- Helpers ---
async function download(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToB2(key, buf, contentType) {
  await b2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buf,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${CDN}/${key}`;
}

function sizeMB(buf) {
  return (buf.byteLength / 1024 / 1024).toFixed(1);
}

// --- Get dates ---
const [rows] = await conn.query(
  `SELECT DISTINCT DATE_FORMAT(post_date, '%Y-%m-%d') AS d
   FROM daily_content
   WHERE mode = ? AND post_date BETWEEN ? AND ?
   ORDER BY d`,
  [MODE, START, END]
);
const dates = rows.map(r => r.d);

console.log(`\n=== ${MODE.toUpperCase()} MEDIA IMPORT ===`);
console.log(`Range: ${START} → ${END}`);
console.log(`Dates found: ${dates.length}\n`);

// ============================================================
//  PASS 1: LumaShort video ({date}.mp4 → lumashort_video_url)
// ============================================================
console.log('--- LumaShort Videos ({date}.mp4) ---\n');
let p1ok = 0, p1skip = 0;

for (const date of dates) {
  const buf = await download(`${BASE_URL}/${date}.mp4`);
  if (!buf) { console.log(`[${date}] SKIP (404)`); p1skip++; continue; }

  try {
    const url = await uploadToB2(`daily-videos/${MODE}/${date}.mp4`, buf, 'video/mp4');
    const [r] = await conn.query(
      'UPDATE daily_content SET lumashort_video_url = ? WHERE mode = ? AND DATE_FORMAT(post_date, "%Y-%m-%d") = ?',
      [url, MODE, date]
    );
    console.log(`[${date}] OK — ${sizeMB(buf)} MB, ${r.changedRows} row(s)`);
    p1ok++;
  } catch (err) { console.log(`[${date}] FAIL — ${err.message}`); p1skip++; }
}
console.log(`\nLumaShorts: ${p1ok} ok, ${p1skip} skipped\n`);

// ============================================================
//  Positivity-only passes
// ============================================================
if (MODE === 'positivity') {

  // PASS 2: Audio ({date}.mp3 → meditation_audio_url)
  console.log('--- Audio ({date}.mp3) ---\n');
  let p2ok = 0, p2skip = 0;

  for (const date of dates) {
    const buf = await download(`${BASE_URL}/${date}.mp3`);
    if (!buf) { console.log(`[${date}] SKIP (404)`); p2skip++; continue; }

    try {
      const url = await uploadToB2(`daily-audio/positivity/${date}.mp3`, buf, 'audio/mpeg');
      const [r] = await conn.query(
        'UPDATE daily_content SET meditation_audio_url = ? WHERE mode = ? AND DATE_FORMAT(post_date, "%Y-%m-%d") = ?',
        [url, MODE, date]
      );
      console.log(`[${date}] OK — ${sizeMB(buf)} MB, ${r.changedRows} row(s)`);
      p2ok++;
    } catch (err) { console.log(`[${date}] FAIL — ${err.message}`); p2skip++; }
  }
  console.log(`\nAudio: ${p2ok} ok, ${p2skip} skipped\n`);

  // PASS 3: SRT ({date}.srt → translations.audio_srt_url for EN)
  console.log('--- Subtitles ({date}.srt) ---\n');
  let p3ok = 0, p3skip = 0;

  for (const date of dates) {
    const buf = await download(`${BASE_URL}/${date}.srt`);
    if (!buf) { console.log(`[${date}] SKIP (404)`); p3skip++; continue; }

    try {
      const url = await uploadToB2(`daily-srt/positivity/${date}.srt`, buf, 'application/x-subrip');

      // Get all positivity content IDs for this date
      const [contentRows] = await conn.query(
        'SELECT id FROM daily_content WHERE mode = ? AND DATE_FORMAT(post_date, "%Y-%m-%d") = ?',
        [MODE, date]
      );

      let updated = 0;
      for (const { id } of contentRows) {
        // Upsert EN translation row with audio_srt_url
        const [existing] = await conn.query(
          'SELECT id FROM daily_content_translations WHERE daily_content_id = ? AND translation_code = ?',
          [id, 'EN']
        );

        if (existing.length > 0) {
          await conn.query(
            'UPDATE daily_content_translations SET audio_srt_url = ? WHERE daily_content_id = ? AND translation_code = ?',
            [url, id, 'EN']
          );
        } else {
          await conn.query(
            'INSERT INTO daily_content_translations (daily_content_id, translation_code, translated_text, audio_srt_url, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
            [id, 'EN', '', url, 'database']
          );
        }
        updated++;
      }
      console.log(`[${date}] OK — ${sizeMB(buf)} MB, ${updated} row(s)`);
      p3ok++;
    } catch (err) { console.log(`[${date}] FAIL — ${err.message}`); p3skip++; }
  }
  console.log(`\nSRT: ${p3ok} ok, ${p3skip} skipped\n`);

  // PASS 4: Background video ({date}-background.mp4 → video_background_url)
  console.log('--- Background Videos ({date}-background.mp4) ---\n');
  let p4ok = 0, p4skip = 0;

  for (const date of dates) {
    const buf = await download(`${BASE_URL}/${date}-background.mp4`);
    if (!buf) { console.log(`[${date}] SKIP (404)`); p4skip++; continue; }

    try {
      const url = await uploadToB2(`daily-videos/positivity-bg/${date}-background.mp4`, buf, 'video/mp4');
      const [r] = await conn.query(
        'UPDATE daily_content SET video_background_url = ? WHERE mode = ? AND DATE_FORMAT(post_date, "%Y-%m-%d") = ?',
        [url, MODE, date]
      );
      console.log(`[${date}] OK — ${sizeMB(buf)} MB, ${r.changedRows} row(s)`);
      p4ok++;
    } catch (err) { console.log(`[${date}] FAIL — ${err.message}`); p4skip++; }
  }
  console.log(`\nBackground: ${p4ok} ok, ${p4skip} skipped\n`);
}

console.log('=== IMPORT COMPLETE ===\n');
await conn.end();
