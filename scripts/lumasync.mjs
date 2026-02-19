#!/usr/bin/env node
/**
 * LumaSync — Fill missing lumashort_video_url values from freelumaquotes.com.
 *
 * Queries daily_content for rows where post_date >= 2026-02-01 and
 * lumashort_video_url IS NULL. For each missing row, checks if a video
 * exists on the remote server, downloads it, uploads to B2, and updates
 * the database.
 *
 * Remote URL pattern:
 *   English:  https://www.freelumaquotes.com/freeluma/{mode}/resources/{date}.mp4
 *   Spanish:  https://www.freelumaquotes.com/freeluma/{mode}/resources/{date}-Spanish.mp4
 *
 * Usage:
 *   node scripts/lumasync.mjs
 *   node scripts/lumasync.mjs --start 2026-03-01
 *   node scripts/lumasync.mjs --dry-run
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
const DRY_RUN = args.includes('--dry-run');
const START = getArg('start') || '2026-02-01';

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

function buildRemoteUrl(mode, date, language) {
  const base = `https://www.freelumaquotes.com/freeluma/${mode}/resources`;
  if (language === 'es') {
    return `${base}/${date}-Spanish.mp4`;
  }
  return `${base}/${date}.mp4`;
}

// --- Query for missing rows ---
const [rows] = await conn.query(
  `SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') AS post_date, mode, language
   FROM daily_content
   WHERE post_date >= ?
     AND (lumashort_video_url IS NULL OR lumashort_video_url = '')
   ORDER BY post_date`,
  [START]
);

console.log(`\n=== LUMASYNC ===`);
console.log(`Missing lumashort_video_url rows (>= ${START}): ${rows.length}`);
if (DRY_RUN) console.log('DRY RUN — no downloads or updates');
console.log('');

let found = 0, notFound = 0, failed = 0;

for (const row of rows) {
  const { id, post_date, mode, language } = row;
  const remoteUrl = buildRemoteUrl(mode, post_date, language);
  const label = `[${post_date} ${mode} ${language}]`;

  if (DRY_RUN) {
    // Just check if remote exists (HEAD request)
    try {
      const res = await fetch(remoteUrl, { method: 'HEAD' });
      if (res.ok) {
        console.log(`${label} AVAILABLE — ${remoteUrl}`);
        found++;
      } else {
        console.log(`${label} NOT FOUND (${res.status})`);
        notFound++;
      }
    } catch {
      console.log(`${label} ERROR checking ${remoteUrl}`);
      notFound++;
    }
    continue;
  }

  // Download
  const buf = await download(remoteUrl);
  if (!buf) {
    console.log(`${label} SKIP (404) — ${remoteUrl}`);
    notFound++;
    continue;
  }

  // Upload to B2
  try {
    const b2Key = `daily-videos/${mode}/${post_date}${language === 'es' ? '-Spanish' : ''}.mp4`;
    const publicUrl = await uploadToB2(b2Key, buf, 'video/mp4');

    // Update DB
    const [result] = await conn.query(
      'UPDATE daily_content SET lumashort_video_url = ? WHERE id = ?',
      [publicUrl, id]
    );

    console.log(`${label} OK — ${sizeMB(buf)} MB → ${b2Key} (${result.changedRows} row updated)`);
    found++;
  } catch (err) {
    console.log(`${label} FAIL — ${err.message}`);
    failed++;
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Synced: ${found}  |  Not found: ${notFound}  |  Failed: ${failed}`);
console.log(`=== DONE ===\n`);

await conn.end();
