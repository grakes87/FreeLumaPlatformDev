#!/usr/bin/env node
/**
 * Copy all files from FreeLumaDaily bucket → FreeLumaPlatform bucket (under daily/)
 * Then fix all database URLs to point to cdn.freeluma.app.
 *
 * What it does:
 * 1. Lists all files in FreeLumaDaily bucket
 * 2. For each file, copies to FreeLumaPlatform under daily/{normalized_path}
 *    - Bible/... → daily/Bible/...  (preserves case)
 *    - root mp4s → daily/{filename}
 * 3. Fixes DB: rewrites s3.us-east-005.backblazeb2.com/FreeLumaDaily/ → cdn.freeluma.app/daily/
 * 4. Fixes DB: decodes %2F → / in all audio_url and audio_srt_url
 *
 * Usage: node scripts/copy-b2-and-fix-urls.mjs
 *        node scripts/copy-b2-and-fix-urls.mjs --db-only   (skip B2 copy, just fix URLs)
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import mysql from 'mysql2/promise';

const execAsync = promisify(exec);

const DB_CONFIG = {
  host: '127.0.0.1',
  user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev',
};

const SRC_BUCKET = 'FreeLumaDaily';
const DST_BUCKET = 'FreeLumaPlatform';
const DST_PREFIX = 'daily';
const CDN_BASE = 'https://cdn.freeluma.app';
const OLD_B2_BASE = 'https://s3.us-east-005.backblazeb2.com/FreeLumaDaily';

const dbOnly = process.argv.includes('--db-only');

async function copyB2Files() {
  console.log(`\n=== Step 1: Copy files from ${SRC_BUCKET} → ${DST_BUCKET}/${DST_PREFIX}/ ===\n`);

  // List all files in source bucket
  const listing = execSync(`b2 ls -r b2://${SRC_BUCKET}/`, { encoding: 'utf8' });
  const files = listing.trim().split('\n').filter(Boolean);
  console.log(`Found ${files.length} files in ${SRC_BUCKET}`);

  // Check what's already in destination
  const existingListing = execSync(`b2 ls -r b2://${DST_BUCKET}/${DST_PREFIX}/`, { encoding: 'utf8' });
  const existingFiles = new Set(existingListing.trim().split('\n').filter(Boolean));
  console.log(`Found ${existingFiles.size} existing files in ${DST_BUCKET}/${DST_PREFIX}/`);

  let copied = 0;
  let skipped = 0;
  let failed = 0;

  // Filter to only files that need copying
  const toCopy = [];
  for (const srcKey of files) {
    const dstKey = `${DST_PREFIX}/${srcKey}`;
    if (existingFiles.has(dstKey)) {
      skipped++;
    } else {
      toCopy.push(srcKey);
    }
  }
  console.log(`${skipped} already exist, ${toCopy.length} to copy`);

  // Copy in parallel batches of 20
  const BATCH_SIZE = 20;
  for (let i = 0; i < toCopy.length; i += BATCH_SIZE) {
    const batch = toCopy.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (srcKey) => {
        const dstKey = `${DST_PREFIX}/${srcKey}`;
        await execAsync(
          `b2 file server-side-copy "b2://${SRC_BUCKET}/${srcKey}" "b2://${DST_BUCKET}/${dstKey}"`,
          { timeout: 60000 }
        );
        return srcKey;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        copied++;
      } else {
        console.error(`  FAILED: ${result.reason?.message?.split('\n')[0]}`);
        failed++;
      }
    }

    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= toCopy.length) {
      console.log(`  Progress: ${copied + failed}/${toCopy.length} (${copied} copied, ${failed} failed)`);
    }
  }

  console.log(`\nB2 copy complete: ${copied} copied, ${skipped} skipped (already exist), ${failed} failed`);
}

async function fixDatabaseUrls() {
  console.log(`\n=== Step 2: Fix database URLs ===\n`);

  const conn = await mysql.createConnection(DB_CONFIG);

  // Count before
  const [before1] = await conn.query(
    `SELECT COUNT(*) as c FROM daily_content_translations WHERE audio_url LIKE ?`,
    [`%${OLD_B2_BASE}%`]
  );
  const [before2] = await conn.query(
    `SELECT COUNT(*) as c FROM daily_content_translations WHERE audio_url LIKE '%\%2F%' OR audio_srt_url LIKE '%\%2F%'`
  );
  console.log(`Rows with old B2 URLs: ${before1[0].c}`);
  console.log(`Rows with %2F encoding: ${before2[0].c}`);

  // Fix 1: Replace old B2 base URL with CDN URL
  // s3.us-east-005.backblazeb2.com/FreeLumaDaily/ → cdn.freeluma.app/daily/
  const [r1] = await conn.query(
    `UPDATE daily_content_translations
     SET audio_url = REPLACE(audio_url, ?, ?)
     WHERE audio_url LIKE ?`,
    [OLD_B2_BASE, `${CDN_BASE}/${DST_PREFIX}`, `%${OLD_B2_BASE}%`]
  );
  console.log(`Fixed ${r1.changedRows} audio_url rows (B2 → CDN)`);

  const [r2] = await conn.query(
    `UPDATE daily_content_translations
     SET audio_srt_url = REPLACE(audio_srt_url, ?, ?)
     WHERE audio_srt_url LIKE ?`,
    [OLD_B2_BASE, `${CDN_BASE}/${DST_PREFIX}`, `%${OLD_B2_BASE}%`]
  );
  console.log(`Fixed ${r2.changedRows} audio_srt_url rows (B2 → CDN)`);

  // Fix 2: Decode %2F → / in all URLs
  // Need to loop since REPLACE only does one pass
  let totalFixed = 0;
  let pass = 0;
  do {
    pass++;
    const [r3] = await conn.query(
      `UPDATE daily_content_translations
       SET audio_url = REPLACE(audio_url, '%2F', '/')
       WHERE audio_url LIKE '%\%2F%'`
    );
    const [r4] = await conn.query(
      `UPDATE daily_content_translations
       SET audio_srt_url = REPLACE(audio_srt_url, '%2F', '/')
       WHERE audio_srt_url LIKE '%\%2F%'`
    );
    const changed = r3.changedRows + r4.changedRows;
    totalFixed += changed;
    if (changed === 0) break;
  } while (pass < 5);
  console.log(`Fixed ${totalFixed} URL fields with %2F decoding (${pass} passes)`);

  // Also fix lowercase 'bible' → 'Bible' for consistency with bucket structure
  // Check what case the destination bucket uses
  const [caseCheck] = await conn.query(
    `SELECT audio_url FROM daily_content_translations
     WHERE audio_url LIKE '%cdn.freeluma.app/daily/bible/%' LIMIT 1`
  );
  if (caseCheck.length > 0) {
    console.log(`\nNote: Some URLs use lowercase 'bible' — this matches the bucket structure.`);
  }

  // Verify after
  const [after1] = await conn.query(
    `SELECT COUNT(*) as c FROM daily_content_translations WHERE audio_url LIKE ?`,
    [`%${OLD_B2_BASE}%`]
  );
  const [after2] = await conn.query(
    `SELECT COUNT(*) as c FROM daily_content_translations WHERE audio_url LIKE '%\%2F%' OR audio_srt_url LIKE '%\%2F%'`
  );
  console.log(`\nAfter fix — old B2 URLs remaining: ${after1[0].c}`);
  console.log(`After fix — %2F encoded remaining: ${after2[0].c}`);

  // Show sample fixed URLs
  const [sample] = await conn.query(
    `SELECT audio_url, audio_srt_url FROM daily_content_translations
     WHERE audio_url IS NOT NULL AND audio_url != ''
     ORDER BY id DESC LIMIT 3`
  );
  console.log('\nSample fixed URLs:');
  sample.forEach(r => console.log(`  audio: ${r.audio_url}\n  srt:   ${r.audio_srt_url}`));

  await conn.end();
}

async function main() {
  try {
    if (!dbOnly) {
      await copyB2Files();
    } else {
      console.log('Skipping B2 copy (--db-only flag)');
    }
    await fixDatabaseUrls();
    console.log('\nDone!');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
