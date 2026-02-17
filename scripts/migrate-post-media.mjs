#!/usr/bin/env node
/**
 * Migrate post media + message media from local files to B2 bucket.
 *
 * Tables handled:
 *   - post_media.url       → posts/{postId}/{filename}
 *   - message_media.media_url → chats/{messageId}/{filename}
 *
 * Usage:
 *   node scripts/migrate-post-media.mjs              # dry-run
 *   node scripts/migrate-post-media.mjs --execute     # upload + update DB
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { lookup } from 'mime-types';
import ExcelJS from 'exceljs';

// ── Config ──────────────────────────────────────────────────────────────────
const B2_REGION = 'us-east-005';
const B2_KEY_ID = process.env.B2_KEY_ID || '0054791eb2a68fb0000000005';
const B2_APP_KEY = process.env.B2_APP_KEY || 'K005DvSQlI7nuXj0L5PF+tri8FNq7y0';
const TARGET_BUCKET = 'FreeLumaPlatform';
const CDN_BASE = 'https://cdn.freeluma.app';
const CONCURRENCY = 3;
const MAX_RETRIES = 3;

const BASE_UPLOADS = join(
  process.cwd(),
  'Old Code/FreeLumaDev-new/free-luma-api/public/uploads'
);
const OLD_POSTS_DIR = join(BASE_UPLOADS, 'posts');
const OLD_CHATS_DIR = join(BASE_UPLOADS, 'chats');

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');

const s3 = new S3Client({
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  region: B2_REGION,
  credentials: { accessKeyId: B2_KEY_ID, secretAccessKey: B2_APP_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fileExistsInBucket(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: TARGET_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(localPath, targetKey, attempt = 1) {
  try {
    const buffer = readFileSync(localPath);
    const contentType = lookup(localPath) || 'application/octet-stream';

    if (await fileExistsInBucket(targetKey)) {
      return { status: 'skipped' };
    }

    await s3.send(new PutObjectCommand({
      Bucket: TARGET_BUCKET,
      Key: targetKey,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    }));

    return { status: 'uploaded' };
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return uploadFile(localPath, targetKey, attempt + 1);
    }
    return { status: 'failed', error: err.message };
  }
}

async function processInBatches(items, fn, concurrency) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if ((i + concurrency) % 50 < concurrency) {
      process.stdout.write(`\r  Progress: ${Math.min(i + concurrency, items.length)}/${items.length}`);
    }
  }
  process.stdout.write(`\r  Progress: ${items.length}/${items.length}\n`);
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Post & Message Media Migration: Local Files → B2/CDN ===');
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`Posts source: ${OLD_POSTS_DIR}`);
  console.log(`Chats source: ${OLD_CHATS_DIR}\n`);

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
    database: 'freeluma_dev',
  });

  const allItems = [];
  const allNotFound = [];

  // ── Part A: Post Media ──────────────────────────────────────────────────
  console.log('═══ PART A: Post Media ═══');

  const [postMedia] = await conn.query(`
    SELECT pm.id, pm.post_id, pm.url, pm.media_type
    FROM post_media pm
    WHERE pm.url NOT LIKE 'http%'
    ORDER BY pm.id
  `);

  console.log(`  Found ${postMedia.length} bare filename entries in post_media`);

  let postFound = 0;
  let postNotFound = 0;

  for (const row of postMedia) {
    const filePath = join(OLD_POSTS_DIR, row.url);
    const targetKey = `posts/${row.post_id}/${row.url}`;
    const cdnUrl = `${CDN_BASE}/${targetKey}`;

    if (existsSync(filePath)) {
      allItems.push({
        table: 'post_media',
        id: row.id,
        refId: row.post_id,
        filename: row.url,
        filePath,
        targetKey,
        cdnUrl,
        column: 'url',
      });
      postFound++;
    } else {
      allNotFound.push({
        table: 'post_media',
        id: row.id,
        refId: row.post_id,
        filename: row.url,
        reason: 'File not found on disk',
      });
      postNotFound++;
    }
  }

  console.log(`  Files found: ${postFound}, NOT found: ${postNotFound}`);

  // ── Part B: Message Media ───────────────────────────────────────────────
  console.log('\n═══ PART B: Message Media ═══');

  const [messageMedia] = await conn.query(`
    SELECT mm.id, mm.message_id, mm.media_url, mm.media_type
    FROM message_media mm
    WHERE mm.media_url NOT LIKE 'http%'
    ORDER BY mm.id
  `);

  console.log(`  Found ${messageMedia.length} bare filename entries in message_media`);

  let msgFound = 0;
  let msgNotFound = 0;

  for (const row of messageMedia) {
    const filePath = join(OLD_CHATS_DIR, row.media_url);
    const targetKey = `chats/${row.message_id}/${row.media_url}`;
    const cdnUrl = `${CDN_BASE}/${targetKey}`;

    if (existsSync(filePath)) {
      allItems.push({
        table: 'message_media',
        id: row.id,
        refId: row.message_id,
        filename: row.media_url,
        filePath,
        targetKey,
        cdnUrl,
        column: 'media_url',
      });
      msgFound++;
    } else {
      allNotFound.push({
        table: 'message_media',
        id: row.id,
        refId: row.message_id,
        filename: row.media_url,
        reason: 'File not found on disk',
      });
      msgNotFound++;
    }
  }

  console.log(`  Files found: ${msgFound}, NOT found: ${msgNotFound}`);

  // ── Sample mappings ─────────────────────────────────────────────────────
  console.log('\nSample upload mappings:');
  for (const item of allItems.slice(0, 4)) {
    console.log(`  [${item.table}] id ${item.id}: ${item.filename}`);
    console.log(`  → ${item.cdnUrl}\n`);
  }

  console.log(`Total to upload: ${allItems.length}`);
  console.log(`Total not found: ${allNotFound.length}`);

  if (!EXECUTE) {
    console.log('\nDRY-RUN complete. Run with --execute to upload and update DB.');
    await conn.end();
    return;
  }

  // ── Upload files ────────────────────────────────────────────────────────
  console.log('\nUploading files to B2...');

  const uploadResults = await processInBatches(allItems, async (item) => {
    const result = await uploadFile(item.filePath, item.targetKey);
    return { ...item, ...result };
  }, CONCURRENCY);

  const uploaded = uploadResults.filter(r => r.status === 'uploaded');
  const skipped = uploadResults.filter(r => r.status === 'skipped');
  const failed = uploadResults.filter(r => r.status === 'failed');

  console.log(`\n  Upload: ${uploaded.length} uploaded, ${skipped.length} already existed, ${failed.length} failed`);

  if (failed.length > 0) {
    console.log('  Sample failures:');
    failed.slice(0, 5).forEach(f => console.log(`    [${f.table}] id ${f.id}: ${f.error}`));
  }

  // ── Update DB ───────────────────────────────────────────────────────────
  console.log('\nUpdating database URLs...');

  const successful = uploadResults.filter(r => r.status === 'uploaded' || r.status === 'skipped');
  let dbUpdated = 0;

  for (const item of successful) {
    if (item.table === 'post_media') {
      await conn.query('UPDATE post_media SET url = ? WHERE id = ?', [item.cdnUrl, item.id]);
    } else {
      await conn.query('UPDATE message_media SET media_url = ? WHERE id = ?', [item.cdnUrl, item.id]);
    }
    dbUpdated++;
  }

  console.log(`  ${dbUpdated} URLs updated in DB`);

  // ── Excel report for failures ───────────────────────────────────────────
  const allFailed = [
    ...allNotFound,
    ...failed.map(f => ({ ...f, reason: `Upload failed: ${f.error}` })),
  ];

  if (allFailed.length > 0) {
    console.log(`\nCreating Excel report for ${allFailed.length} failed items...`);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Failed Media');

    sheet.columns = [
      { header: 'Table', key: 'table', width: 18 },
      { header: 'Row ID', key: 'id', width: 10 },
      { header: 'Ref ID (post/msg)', key: 'refId', width: 18 },
      { header: 'Filename', key: 'filename', width: 40 },
      { header: 'Reason', key: 'reason', width: 50 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    for (const item of allFailed) {
      sheet.addRow({
        table: item.table,
        id: item.id,
        refId: item.refId,
        filename: item.filename,
        reason: item.reason,
      });
    }

    const excelPath = join(process.cwd(), 'failed-post-media.xlsx');
    await workbook.xlsx.writeFile(excelPath);
    console.log(`  Saved to: ${excelPath}`);
  }

  // ── Verification ────────────────────────────────────────────────────────
  console.log('\nVerification...');

  const [pmRemaining] = await conn.query(`
    SELECT COUNT(*) AS cnt FROM post_media WHERE url NOT LIKE 'http%'
  `);
  const [mmRemaining] = await conn.query(`
    SELECT COUNT(*) AS cnt FROM message_media WHERE media_url NOT LIKE 'http%'
  `);
  const [pmCdn] = await conn.query(`
    SELECT COUNT(*) AS cnt FROM post_media WHERE url LIKE 'https://cdn.freeluma.app/%'
  `);
  const [mmCdn] = await conn.query(`
    SELECT COUNT(*) AS cnt FROM message_media WHERE media_url LIKE 'https://cdn.freeluma.app/%'
  `);

  console.log(`  post_media bare remaining: ${pmRemaining[0].cnt}`);
  console.log(`  message_media bare remaining: ${mmRemaining[0].cnt}`);
  console.log(`  post_media CDN URLs: ${pmCdn[0].cnt}`);
  console.log(`  message_media CDN URLs: ${mmCdn[0].cnt}`);

  console.log('\nSummary:');
  console.log(`  Uploaded:        ${uploaded.length}`);
  console.log(`  Already existed: ${skipped.length}`);
  console.log(`  DB updated:      ${dbUpdated}`);
  console.log(`  Not found:       ${allNotFound.length}`);
  console.log(`  Upload failed:   ${failed.length}`);

  await conn.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
