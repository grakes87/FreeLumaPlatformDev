#!/usr/bin/env node

/**
 * Migrate old post media files to B2 and update production DB URLs.
 *
 * Usage: node scripts/migrate-post-media-to-b2.mjs [--dry-run]
 *
 * Reads bare-filename post_media rows from prod DB, looks for matching files
 * in "Old Database/posts/", uploads to B2 under posts/legacy/{filename},
 * and updates the DB URL to the full CDN path.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');
const POSTS_DIR = path.join(ROOT, 'Old Database', 'posts');

// B2 config
const B2_REGION = process.env.B2_REGION;
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_BUCKET = process.env.B2_BUCKET_NAME;
const CDN_BASE = `https://f005.backblazeb2.com/file/${B2_BUCKET}`;

// Production DB config — use env vars if set, else prompt
const DB_HOST = process.env.PROD_DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.PROD_DB_PORT || '3306', 10);
const DB_USER = process.env.PROD_DB_USER || process.env.DB_USER;
const DB_PASS = process.env.PROD_DB_PASS || process.env.DB_PASS;
const DB_NAME = process.env.PROD_DB_NAME || 'freeluma_prod';

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4a': 'audio/mp4',
};

const s3 = new S3Client({
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  region: B2_REGION,
  credentials: { accessKeyId: B2_KEY_ID, secretAccessKey: B2_APP_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async function main() {
  console.log(`Post media migration → B2`);
  console.log(`Posts dir: ${POSTS_DIR}`);
  console.log(`DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  console.log(`Dry run: ${DRY_RUN}\n`);

  // Connect via SSH tunnel — user should have tunnel open on localhost:3306
  // Or run this on the app server itself
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
  });

  // Get all bare-filename media rows (not starting with http, not base64)
  const [rows] = await conn.query(
    `SELECT id, post_id, media_type, url FROM post_media
     WHERE url NOT LIKE 'http%' AND url NOT LIKE 'data:%'`
  );

  console.log(`Found ${rows.length} bare-filename media rows\n`);

  let uploaded = 0;
  let missing = 0;
  let skipped = 0;

  for (const row of rows) {
    const filename = row.url;
    const localPath = path.join(POSTS_DIR, filename);

    if (!fs.existsSync(localPath)) {
      console.log(`  MISSING: ${filename} (media_id=${row.id}, post_id=${row.post_id})`);
      missing++;
      continue;
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const b2Key = `posts/legacy/${filename}`;
    const publicUrl = `${CDN_BASE}/${b2Key}`;

    if (DRY_RUN) {
      console.log(`  DRY-RUN: ${filename} → ${b2Key}`);
      uploaded++;
      continue;
    }

    try {
      const fileBuffer = fs.readFileSync(localPath);
      await s3.send(new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: b2Key,
        Body: fileBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));

      await conn.query(
        'UPDATE post_media SET url = ? WHERE id = ?',
        [publicUrl, row.id]
      );

      console.log(`  UPLOADED: ${filename} → ${publicUrl} (media_id=${row.id})`);
      uploaded++;
    } catch (err) {
      console.error(`  ERROR: ${filename} — ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Missing: ${missing}, Errors: ${skipped}`);
  await conn.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
