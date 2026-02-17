#!/usr/bin/env node
/**
 * Migrate daily content files from FreeLumaDaily bucket to FreeLumaPlatform bucket.
 *
 * Since the B2 API key may only have access to FreeLumaPlatform, this script:
 * 1. Downloads files from the public FreeLumaDaily URLs
 * 2. Uploads them to FreeLumaPlatform/daily/... via S3 PutObject
 * 3. Updates all DB URLs to use cdn.freeluma.app/daily/...
 *
 * Usage:
 *   node scripts/migrate-daily-to-cdn.mjs              # dry-run (no changes)
 *   node scripts/migrate-daily-to-cdn.mjs --execute     # actually copy + update DB
 *   node scripts/migrate-daily-to-cdn.mjs --db-only     # skip copy, only update DB URLs
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';

// ── Config ──────────────────────────────────────────────────────────────────
const B2_REGION = 'us-east-005';
const B2_KEY_ID = process.env.B2_KEY_ID || '0054791eb2a68fb0000000005';
const B2_APP_KEY = process.env.B2_APP_KEY || 'K005DvSQlI7nuXj0L5PF+tri8FNq7y0';
const TARGET_BUCKET = 'FreeLumaPlatform';
const CDN_BASE = 'https://cdn.freeluma.app';
const TARGET_PREFIX = 'daily/'; // files go to FreeLumaPlatform/daily/...
const CONCURRENCY = 3; // parallel uploads (conservative to avoid socket drops)
const MAX_RETRIES = 3;

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const DB_ONLY = args.includes('--db-only');

const s3 = new S3Client({
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  region: B2_REGION,
  credentials: { accessKeyId: B2_KEY_ID, secretAccessKey: B2_APP_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the path portion after FreeLumaDaily/ from a full URL */
function extractPath(url) {
  const idx = url.indexOf('FreeLumaDaily/');
  if (idx === -1) return null;
  return url.slice(idx + 'FreeLumaDaily/'.length);
}

/** Build the new CDN URL for a given old URL */
function newUrl(oldUrl) {
  const path = extractPath(oldUrl);
  if (!path) return null;
  return `${CDN_BASE}/${TARGET_PREFIX}${path}`;
}

/** Check if a file already exists in the target bucket */
async function fileExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: TARGET_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Download from public URL, upload to target bucket */
async function copyFile(oldUrl, attempt = 1) {
  const path = extractPath(oldUrl);
  if (!path) throw new Error(`Cannot parse path from: ${oldUrl}`);
  const targetKey = `${TARGET_PREFIX}${path}`;

  // Check if already copied
  if (await fileExists(targetKey)) {
    return { status: 'skipped', key: targetKey };
  }

  try {
    // Download full file into buffer (avoids stream socket drops during S3 upload)
    const res = await fetch(oldUrl);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await res.arrayBuffer());

    // Upload to target bucket
    const putCmd = new PutObjectCommand({
      Bucket: TARGET_BUCKET,
      Key: targetKey,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    });

    await s3.send(putCmd);
    return { status: 'copied', key: targetKey };
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`  Retry ${attempt}/${MAX_RETRIES} for ${path}: ${err.message}`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return copyFile(oldUrl, attempt + 1);
    }
    return { status: 'failed', key: targetKey, error: err.message };
  }
}

/** Process items in batches with concurrency limit */
async function processInBatches(items, fn, concurrency) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      process.stdout.write(`\r  Progress: ${Math.min(i + concurrency, items.length)}/${items.length}`);
    }
  }
  process.stdout.write(`\r  Progress: ${items.length}/${items.length}\n`);
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Daily Content Migration: FreeLumaDaily → FreeLumaPlatform ===');
  console.log(`Mode: ${DB_ONLY ? 'DB-only (skip file copy)' : EXECUTE ? 'EXECUTE (copy + update DB)' : 'DRY-RUN (no changes)'}\n`);

  // Connect to DB
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
    database: 'freeluma_dev',
  });

  // ── Step 1: Collect all unique FreeLumaDaily URLs ─────────────────────
  console.log('Step 1: Collecting URLs from database...');

  const [allUrls] = await conn.query(`
    SELECT video_background_url AS url, 'dc.video_background_url' AS col FROM daily_content WHERE video_background_url LIKE '%FreeLumaDaily%'
    UNION ALL
    SELECT lumashort_video_url, 'dc.lumashort_video_url' FROM daily_content WHERE lumashort_video_url LIKE '%FreeLumaDaily%'
    UNION ALL
    SELECT audio_url, 'dct.audio_url' FROM daily_content_translations WHERE audio_url LIKE '%FreeLumaDaily%'
    UNION ALL
    SELECT audio_srt_url, 'dct.audio_srt_url' FROM daily_content_translations WHERE audio_srt_url LIKE '%FreeLumaDaily%'
  `);

  // Deduplicate URLs
  const uniqueUrls = [...new Set(allUrls.map(r => r.url))];

  // Categorize
  const backgrounds = uniqueUrls.filter(u => u.includes('-background.'));
  const lumaShorts = uniqueUrls.filter(u => !u.includes('-background.') && u.endsWith('.mp4'));
  const audio = uniqueUrls.filter(u => u.endsWith('.mp3'));
  const srt = uniqueUrls.filter(u => u.endsWith('.srt'));

  console.log(`  Found ${uniqueUrls.length} unique URLs:`);
  console.log(`    Background videos: ${backgrounds.length}`);
  console.log(`    LumaShort videos:  ${lumaShorts.length}`);
  console.log(`    Audio files:       ${audio.length}`);
  console.log(`    SRT subtitles:     ${srt.length}`);
  console.log(`  Total DB rows to update: ${allUrls.length}\n`);

  // Show sample mappings
  console.log('Sample URL mappings:');
  for (const url of uniqueUrls.slice(0, 3)) {
    console.log(`  ${url}`);
    console.log(`  → ${newUrl(url)}\n`);
  }

  if (!EXECUTE && !DB_ONLY) {
    console.log('DRY-RUN complete. Run with --execute to copy files and update DB.');
    console.log('Run with --db-only to skip file copy and only update DB URLs.');
    await conn.end();
    return;
  }

  // ── Step 2: Copy files ────────────────────────────────────────────────
  if (!DB_ONLY) {
    console.log('Step 2: Copying files to FreeLumaPlatform bucket...');

    console.log('\n  Backgrounds:');
    const bgResults = await processInBatches(backgrounds, copyFile, CONCURRENCY);

    console.log('  LumaShorts:');
    const lsResults = await processInBatches(lumaShorts, copyFile, CONCURRENCY);

    console.log('  Audio:');
    const audioResults = await processInBatches(audio, copyFile, CONCURRENCY);

    console.log('  SRT subtitles:');
    const srtResults = await processInBatches(srt, copyFile, CONCURRENCY);

    const allResults = [...bgResults, ...lsResults, ...audioResults, ...srtResults];
    const copied = allResults.filter(r => r.status === 'copied').length;
    const skipped = allResults.filter(r => r.status === 'skipped').length;
    const failed = allResults.filter(r => r.status === 'failed');

    console.log(`\n  Copy results: ${copied} copied, ${skipped} already existed, ${failed.length} failed`);
    if (failed.length > 0) {
      console.log('  Failed files:');
      failed.forEach(f => console.log(`    ${f.key}: ${f.error}`));

      if (failed.length > 10) {
        console.error('\nToo many failures. Aborting DB update. Fix issues and re-run.');
        await conn.end();
        process.exit(1);
      }
      console.log('\n  Proceeding with DB update (failed files will keep old URLs)...');
    }

    // Track failed paths to skip them in DB update
    var failedPaths = new Set(failed.map(f => f.key.replace(TARGET_PREFIX, ''))); // eslint-disable-line no-var
  } else {
    console.log('Step 2: Skipped (--db-only mode)\n');
    var failedPaths = new Set(); // eslint-disable-line no-var
  }

  // ── Step 3: Update DB URLs ────────────────────────────────────────────
  console.log('Step 3: Updating database URLs...');

  let updated = 0;

  // Helper: update column in table
  async function updateColumn(table, column, condition = '') {
    const where = condition || `${column} LIKE '%FreeLumaDaily%'`;
    const [rows] = await conn.query(`SELECT id, ${column} AS url FROM ${table} WHERE ${where}`);

    let colUpdated = 0;
    for (const row of rows) {
      const path = extractPath(row.url);
      if (!path || failedPaths.has(path)) continue;

      const cdnUrl = `${CDN_BASE}/${TARGET_PREFIX}${path}`;
      await conn.query(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [cdnUrl, row.id]);
      colUpdated++;
    }
    console.log(`  ${table}.${column}: ${colUpdated} rows updated`);
    updated += colUpdated;
  }

  await updateColumn('daily_content', 'video_background_url');
  await updateColumn('daily_content', 'lumashort_video_url');
  await updateColumn('daily_content_translations', 'audio_url');
  await updateColumn('daily_content_translations', 'audio_srt_url');

  console.log(`\n  Total DB rows updated: ${updated}`);

  // ── Step 4: Verify ────────────────────────────────────────────────────
  console.log('\nStep 4: Verification...');

  const [remaining] = await conn.query(`
    SELECT COUNT(*) AS cnt FROM (
      SELECT video_background_url AS url FROM daily_content WHERE video_background_url LIKE '%FreeLumaDaily%'
      UNION ALL
      SELECT lumashort_video_url FROM daily_content WHERE lumashort_video_url LIKE '%FreeLumaDaily%'
      UNION ALL
      SELECT audio_url FROM daily_content_translations WHERE audio_url LIKE '%FreeLumaDaily%'
      UNION ALL
      SELECT audio_srt_url FROM daily_content_translations WHERE audio_srt_url LIKE '%FreeLumaDaily%'
    ) t
  `);

  const [cdnCount] = await conn.query(`
    SELECT COUNT(*) AS cnt FROM (
      SELECT video_background_url AS url FROM daily_content WHERE video_background_url LIKE '%cdn.freeluma%'
      UNION ALL
      SELECT lumashort_video_url FROM daily_content WHERE lumashort_video_url LIKE '%cdn.freeluma%'
      UNION ALL
      SELECT audio_url FROM daily_content_translations WHERE audio_url LIKE '%cdn.freeluma%'
      UNION ALL
      SELECT audio_srt_url FROM daily_content_translations WHERE audio_srt_url LIKE '%cdn.freeluma%'
    ) t
  `);

  console.log(`  FreeLumaDaily URLs remaining: ${remaining[0].cnt}`);
  console.log(`  CDN URLs now: ${cdnCount[0].cnt}`);

  if (remaining[0].cnt === 0) {
    console.log('\n  All URLs migrated successfully!');
  } else {
    console.log(`\n  ${remaining[0].cnt} URLs still point to FreeLumaDaily (likely failed copies).`);
  }

  await conn.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
