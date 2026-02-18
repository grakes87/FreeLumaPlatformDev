#!/usr/bin/env node
/**
 * Find all positivity daily_content rows missing lumashort_video_url,
 * attempt to download from freelumaquotes.com, upload to B2, and update DB.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';

const BASE_URL = 'https://www.freelumaquotes.com/freeluma/positivity/resources';

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

// Find all positivity rows missing lumashort_video_url
const [rows] = await conn.query(`
  SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') AS d, language
  FROM daily_content
  WHERE mode = 'positivity'
    AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
    AND (lumashort_video_url IS NULL OR lumashort_video_url = '')
  ORDER BY post_date, language
`);

console.log(`Found ${rows.length} positivity rows missing lumashort_video_url\n`);

let ok = 0, notFound = 0, failed = 0;

for (const row of rows) {
  const url = `${BASE_URL}/${row.d}.mp4`;
  process.stdout.write(`[${row.d}] ${row.language} — `);

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.log(`FAIL (network: ${err.message})`);
    failed++;
    continue;
  }

  if (!res.ok) {
    console.log(`SKIP (HTTP ${res.status})`);
    notFound++;
    continue;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const sizeMB = (buf.byteLength / 1024 / 1024).toFixed(1);

  const key = `daily-videos/positivity/${row.d}.mp4`;
  try {
    await b2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buf,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  } catch (err) {
    console.log(`FAIL (B2: ${err.message})`);
    failed++;
    continue;
  }

  const cdnUrl = `${CDN}/${key}`;
  const [result] = await conn.query(
    'UPDATE daily_content SET lumashort_video_url = ? WHERE id = ?',
    [cdnUrl, row.id]
  );

  console.log(`OK — ${sizeMB} MB, updated=${result.changedRows}`);
  ok++;
}

console.log(`\n=== DONE ===`);
console.log(`Success: ${ok}`);
console.log(`Not found (404): ${notFound}`);
console.log(`Failed: ${failed}`);

// Verify remaining
const [remaining] = await conn.query(`
  SELECT COUNT(*) as cnt FROM daily_content
  WHERE mode = 'positivity'
    AND post_date BETWEEN '2026-02-01' AND '2026-03-31'
    AND (lumashort_video_url IS NULL OR lumashort_video_url = '')
`);
console.log(`\nStill missing lumashort_video_url: ${remaining[0].cnt}`);

await conn.end();
