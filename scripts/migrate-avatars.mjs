#!/usr/bin/env node
/**
 * Migrate user avatars from local files to B2 bucket (FreeLumaPlatform).
 *
 * 1. Reads all users with bare filename avatar_url (not starting with http)
 * 2. Checks if the file exists in the old uploads directory
 * 3. Uploads to FreeLumaPlatform/avatars/{userId}/{filename} via S3 PutObject
 * 4. Updates avatar_url in DB to CDN URL
 * 5. Creates Excel report for users whose files were not found
 *
 * Usage:
 *   node scripts/migrate-avatars.mjs              # dry-run
 *   node scripts/migrate-avatars.mjs --execute     # actually upload + update DB
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
const CONCURRENCY = 5;
const MAX_RETRIES = 3;

const OLD_AVATARS_DIR = join(
  process.cwd(),
  'Old Code/FreeLumaDev-new/free-luma-api/public/uploads/user'
);

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
    const contentType = lookup(localPath) || 'image/jpeg';

    // Check if already uploaded
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
    if ((i + concurrency) % 100 < concurrency) {
      process.stdout.write(`\r  Progress: ${Math.min(i + concurrency, items.length)}/${items.length}`);
    }
  }
  process.stdout.write(`\r  Progress: ${items.length}/${items.length}\n`);
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Avatar Migration: Local Files → B2/CDN ===');
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`Source: ${OLD_AVATARS_DIR}\n`);

  if (!existsSync(OLD_AVATARS_DIR)) {
    console.error('ERROR: Old avatars directory not found');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
    database: 'freeluma_dev',
  });

  // ── Step 1: Get users with bare filename avatars ──────────────────────
  console.log('Step 1: Finding users with bare filename avatars...');

  const [users] = await conn.query(`
    SELECT id, username, avatar_url
    FROM users
    WHERE avatar_url IS NOT NULL
      AND avatar_url != ''
      AND avatar_url NOT LIKE 'http%'
      AND deleted_at IS NULL
    ORDER BY id
  `);

  console.log(`  Found ${users.length} users with bare filename avatars\n`);

  // ── Step 2: Check which files exist ───────────────────────────────────
  console.log('Step 2: Checking file existence...');

  const found = [];
  const notFound = [];

  for (const user of users) {
    const filePath = join(OLD_AVATARS_DIR, user.avatar_url);
    if (existsSync(filePath)) {
      found.push({ ...user, filePath });
    } else {
      notFound.push(user);
    }
  }

  console.log(`  Files found:     ${found.length}`);
  console.log(`  Files NOT found: ${notFound.length}\n`);

  // ── Step 3: Show sample mappings ──────────────────────────────────────
  console.log('Sample upload mappings:');
  for (const user of found.slice(0, 3)) {
    const targetKey = `avatars/${user.id}/${user.avatar_url}`;
    const cdnUrl = `${CDN_BASE}/${targetKey}`;
    console.log(`  user ${user.id} (${user.username}): ${user.avatar_url}`);
    console.log(`  → ${cdnUrl}\n`);
  }

  if (!EXECUTE) {
    console.log('DRY-RUN complete. Run with --execute to upload files and update DB.');
    console.log(`\n${notFound.length} users will be logged to failed-avatars.xlsx`);
    await conn.end();
    return;
  }

  // ── Step 4: Upload files ──────────────────────────────────────────────
  console.log('Step 4: Uploading avatars to B2...');

  const uploadResults = await processInBatches(found, async (user) => {
    const targetKey = `avatars/${user.id}/${user.avatar_url}`;
    const result = await uploadFile(user.filePath, targetKey);
    return { ...user, targetKey, ...result };
  }, CONCURRENCY);

  const uploaded = uploadResults.filter(r => r.status === 'uploaded');
  const skipped = uploadResults.filter(r => r.status === 'skipped');
  const failed = uploadResults.filter(r => r.status === 'failed');

  console.log(`\n  Upload results: ${uploaded.length} uploaded, ${skipped.length} already existed, ${failed.length} failed`);

  if (failed.length > 0) {
    console.log('  Sample failures:');
    failed.slice(0, 5).forEach(f => console.log(`    user ${f.id}: ${f.error}`));
  }

  // ── Step 5: Update DB URLs ────────────────────────────────────────────
  console.log('\nStep 5: Updating database avatar URLs...');

  const successfulUploads = uploadResults.filter(r => r.status === 'uploaded' || r.status === 'skipped');
  let dbUpdated = 0;

  for (const user of successfulUploads) {
    const cdnUrl = `${CDN_BASE}/${user.targetKey}`;
    await conn.query('UPDATE users SET avatar_url = ? WHERE id = ?', [cdnUrl, user.id]);
    dbUpdated++;
  }

  console.log(`  ${dbUpdated} avatar URLs updated in DB`);

  // ── Step 6: Create Excel for failures ─────────────────────────────────
  const allFailed = [
    ...notFound.map(u => ({ ...u, reason: 'File not found on disk' })),
    ...failed.map(u => ({ ...u, reason: `Upload failed: ${u.error}` })),
  ];

  if (allFailed.length > 0) {
    console.log(`\nStep 6: Creating Excel report for ${allFailed.length} failed avatars...`);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Failed Avatars');

    sheet.columns = [
      { header: 'User ID', key: 'id', width: 10 },
      { header: 'Username', key: 'username', width: 25 },
      { header: 'Avatar Filename', key: 'avatar_url', width: 40 },
      { header: 'Reason', key: 'reason', width: 50 },
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    for (const user of allFailed) {
      sheet.addRow({
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        reason: user.reason,
      });
    }

    const excelPath = join(process.cwd(), 'failed-avatars.xlsx');
    await workbook.xlsx.writeFile(excelPath);
    console.log(`  Saved to: ${excelPath}`);
  }

  // ── Step 7: Verification ──────────────────────────────────────────────
  console.log('\nStep 7: Verification...');

  const [remaining] = await conn.query(`
    SELECT COUNT(*) AS cnt FROM users
    WHERE avatar_url IS NOT NULL AND avatar_url != ''
      AND avatar_url NOT LIKE 'http%' AND deleted_at IS NULL
  `);

  const [cdnCount] = await conn.query(`
    SELECT COUNT(*) AS cnt FROM users
    WHERE avatar_url LIKE 'https://cdn.freeluma.app/%' AND deleted_at IS NULL
  `);

  console.log(`  Bare filename avatars remaining: ${remaining[0].cnt}`);
  console.log(`  CDN avatars now: ${cdnCount[0].cnt}`);

  console.log(`\nSummary:`);
  console.log(`  Uploaded:        ${uploaded.length}`);
  console.log(`  Already existed: ${skipped.length}`);
  console.log(`  DB updated:      ${dbUpdated}`);
  console.log(`  File not found:  ${notFound.length}`);
  console.log(`  Upload failed:   ${failed.length}`);

  await conn.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
