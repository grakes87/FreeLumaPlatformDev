#!/usr/bin/env node
/**
 * Download bible creator videos from old FreeLuma CDN and upload to Backblaze B2.
 *
 * For each daily_content row with mode='bible', language='en', and no lumashort_video_url:
 * 1. HEAD check https://www.freelumaquotes.com/freeluma/bible/{date}.mp4
 * 2. If exists, download the .mp4
 * 3. Upload to B2: daily-content-video/{date}/creator.mp4
 * 4. Update DB: lumashort_video_url = https://cdn.freeluma.app/daily-content-video/{date}/creator.mp4
 *
 * Usage: node scripts/import-creator-videos.mjs
 */

import mysql from 'mysql2/promise';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const DB_CONFIG = {
  host: '127.0.0.1',
  user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev',
};

const b2Client = new S3Client({
  endpoint: 'https://s3.us-east-005.backblazeb2.com',
  region: 'us-east-005',
  credentials: {
    accessKeyId: '0054791eb2a68fb0000000005',
    secretAccessKey: 'K005DvSQlI7nuXj0L5PF+tri8FNq7y0',
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const BUCKET = 'FreeLumaPlatform';
const CDN_BASE = 'https://cdn.freeluma.app';
const SOURCE_BASE = 'https://www.freelumaquotes.com/freeluma/bible';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(d) {
  // d is a Date object — format as YYYY-MM-DD
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    // 1. Query DB for dates that need creator videos
    const [rows] = await conn.query(
      `SELECT post_date FROM daily_content
       WHERE mode = 'bible' AND language = 'en'
         AND (lumashort_video_url IS NULL OR lumashort_video_url = '')
         AND post_date >= '2026-02-01'
       ORDER BY post_date ASC`
    );

    console.log(`Found ${rows.length} bible/en rows missing lumashort_video_url (>= 2026-02-01)\n`);

    if (rows.length === 0) {
      console.log('Nothing to do.');
      await conn.end();
      return;
    }

    let found = 0;
    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      const date = formatDate(new Date(row.post_date));
      const sourceUrl = `${SOURCE_BASE}/${date}.mp4`;

      // 2. HEAD request to check existence
      let headRes;
      try {
        headRes = await fetch(sourceUrl, { method: 'HEAD' });
      } catch (err) {
        console.log(`  [${date}] Network error on HEAD: ${err.message}`);
        failed++;
        await sleep(500);
        continue;
      }

      if (!headRes.ok) {
        // 404 or other error — skip silently
        skipped++;
        await sleep(500);
        continue;
      }

      const contentLength = headRes.headers.get('content-length');
      const sizeMB = contentLength ? (parseInt(contentLength, 10) / 1024 / 1024).toFixed(2) : '?';
      found++;

      // 3. Download the video
      let videoBuffer;
      try {
        const dlRes = await fetch(sourceUrl);
        if (!dlRes.ok) {
          console.log(`  [${date}] Download failed: HTTP ${dlRes.status}`);
          failed++;
          await sleep(500);
          continue;
        }
        videoBuffer = Buffer.from(await dlRes.arrayBuffer());
      } catch (err) {
        console.log(`  [${date}] Download error: ${err.message}`);
        failed++;
        await sleep(500);
        continue;
      }

      // 4. Upload to B2
      const b2Key = `daily-content-video/${date}/creator.mp4`;
      const cdnUrl = `${CDN_BASE}/${b2Key}`;

      try {
        await b2Client.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: b2Key,
            Body: videoBuffer,
            ContentType: 'video/mp4',
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
      } catch (err) {
        console.log(`  [${date}] B2 upload failed: ${err.message}`);
        failed++;
        await sleep(500);
        continue;
      }

      // 5. Update DB
      try {
        const [result] = await conn.query(
          `UPDATE daily_content
           SET lumashort_video_url = ?
           WHERE post_date = ? AND mode = 'bible' AND language = 'en'
             AND (lumashort_video_url IS NULL OR lumashort_video_url = '')`,
          [cdnUrl, date]
        );
        console.log(`  [${date}] OK — ${sizeMB} MB — uploaded & DB updated (${result.changedRows} row)`);
        uploaded++;
      } catch (err) {
        console.log(`  [${date}] DB update failed: ${err.message}`);
        failed++;
      }

      // 500ms delay between downloads
      await sleep(500);
    }

    // 6. Report totals
    console.log(`\n=== Summary ===`);
    console.log(`Total dates checked: ${rows.length}`);
    console.log(`Videos found on CDN: ${found}`);
    console.log(`Uploaded to B2 + DB: ${uploaded}`);
    console.log(`Skipped (404/empty):  ${skipped}`);
    console.log(`Failed:              ${failed}`);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
