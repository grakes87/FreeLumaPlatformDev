#!/usr/bin/env node
/**
 * Import positivity audio + SRT from old site, upload to B2, seed meditation scripts.
 *
 * For each positivity daily_content from 2026-02-01 onward:
 * 1. Download MP3 from https://www.freelumaquotes.com/freeluma/positivity/resources/{date}.mp3
 * 2. Download SRT from https://www.freelumaquotes.com/freeluma/positivity/resources/{date}.srt
 * 3. Upload both to B2 at daily-content-audio/{date}/EN.mp3 and EN.srt
 * 4. Update daily_content_translations for EN with audio_url + audio_srt_url
 * 5. If successful, seed a meditation_script on the daily_content row
 *
 * Usage: node scripts/import-positivity-audio.mjs
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config from .env.local
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    let value = trimmed.slice(eqIdx + 1);
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv();

const DB_CONFIG = {
  host: env.DB_HOST || '127.0.0.1',
  port: parseInt(env.DB_PORT || '3306', 10),
  user: env.DB_USER || 'root',
  password: env.DB_PASS || '',
  database: env.DB_NAME || 'freeluma_dev',
};

const B2_REGION = env.B2_REGION;
const B2_KEY_ID = env.B2_KEY_ID;
const B2_APP_KEY = env.B2_APP_KEY;
const B2_BUCKET = env.B2_BUCKET_NAME;
const CDN_BASE = env.CDN_BASE_URL || `https://f005.backblazeb2.com/file/${B2_BUCKET}`;

const OLD_SITE_BASE = 'https://www.freelumaquotes.com/freeluma/positivity/resources';
const START_DATE = '2026-02-01';

// ---------------------------------------------------------------------------
// B2 Client
// ---------------------------------------------------------------------------

const b2 = new S3Client({
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  region: B2_REGION,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APP_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async function uploadToB2(key, buffer, contentType) {
  await b2.send(new PutObjectCommand({
    Bucket: B2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${CDN_BASE}/${key}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function downloadFile(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer;
}

function buildMeditationScript(quote) {
  // Seed meditation script — a gentle 1-minute guided meditation based on the quote
  return `Find a comfortable position and gently close your eyes. Take a deep breath in through your nose... and slowly release it through your mouth.

Let today's message settle into your heart: "${quote}"

Take another deep breath. As you inhale, imagine drawing in the energy of these words. As you exhale, release any tension you're holding.

Think about what this message means to you right now, in this moment of your life. How can you carry this truth with you today?

Take one more deep, cleansing breath. Feel the calm and clarity that comes from this reflection.

When you're ready, gently open your eyes. Carry this message with you throughout your day, and let it guide your thoughts and actions.`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Positivity Audio Import ===');
  console.log(`Source: ${OLD_SITE_BASE}`);
  console.log(`Start date: ${START_DATE}`);
  console.log();

  const db = await mysql.createConnection(DB_CONFIG);

  try {
    // Get all positivity daily_content from start date onward
    const [rows] = await db.execute(
      `SELECT dc.id, dc.post_date, dc.content_text, dc.meditation_script
       FROM daily_content dc
       WHERE dc.mode = 'positivity'
         AND dc.language = 'en'
         AND dc.post_date >= ?
       ORDER BY dc.post_date ASC`,
      [START_DATE]
    );

    console.log(`Found ${rows.length} positivity content rows from ${START_DATE}\n`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let meditationSeeded = 0;

    for (const row of rows) {
      const date = typeof row.post_date === 'string'
        ? row.post_date
        : row.post_date.toISOString().split('T')[0];

      // Check if EN translation already has audio
      const [existing] = await db.execute(
        `SELECT audio_url, audio_srt_url FROM daily_content_translations
         WHERE daily_content_id = ? AND translation_code = 'EN'`,
        [row.id]
      );

      if (existing.length > 0 && existing[0].audio_url) {
        console.log(`[SKIP] ${date} — already has audio`);
        skipped++;
        continue;
      }

      // Download audio
      const mp3Url = `${OLD_SITE_BASE}/${date}.mp3`;
      const srtUrl = `${OLD_SITE_BASE}/${date}.srt`;

      const mp3Buffer = await downloadFile(mp3Url);
      if (!mp3Buffer) {
        console.log(`[FAIL] ${date} — could not download MP3 from ${mp3Url}`);
        failed++;
        continue;
      }

      const srtBuffer = await downloadFile(srtUrl);
      if (!srtBuffer) {
        console.log(`[WARN] ${date} — MP3 ok but no SRT available, uploading audio only`);
      }

      // Upload to B2
      try {
        const audioKey = `daily-content-audio/${date}/EN.mp3`;
        const audioUrl = await uploadToB2(audioKey, mp3Buffer, 'audio/mpeg');

        let srtCdnUrl = null;
        if (srtBuffer) {
          const srtKey = `daily-content-audio/${date}/EN.srt`;
          srtCdnUrl = await uploadToB2(srtKey, srtBuffer, 'application/x-subrip');
        }

        // Upsert daily_content_translations for EN
        if (existing.length > 0) {
          // Update existing row
          await db.execute(
            `UPDATE daily_content_translations
             SET audio_url = ?, audio_srt_url = COALESCE(?, audio_srt_url)
             WHERE daily_content_id = ? AND translation_code = 'EN'`,
            [audioUrl, srtCdnUrl, row.id]
          );
        } else {
          // Create EN translation row
          await db.execute(
            `INSERT INTO daily_content_translations
             (daily_content_id, translation_code, translated_text, audio_url, audio_srt_url, source, created_at, updated_at)
             VALUES (?, 'EN', ?, ?, ?, 'database', NOW(), NOW())`,
            [row.id, row.content_text || '', audioUrl, srtCdnUrl]
          );
        }

        console.log(`[OK]   ${date} — audio${srtBuffer ? ' + SRT' : ''} uploaded`);
        imported++;

        // Seed meditation script if not already present
        if (!row.meditation_script && row.content_text) {
          const meditationText = buildMeditationScript(row.content_text);
          await db.execute(
            `UPDATE daily_content SET meditation_script = ? WHERE id = ?`,
            [meditationText, row.id]
          );
          meditationSeeded++;
        }

      } catch (uploadErr) {
        console.log(`[FAIL] ${date} — B2 upload error: ${uploadErr.message}`);
        failed++;
      }
    }

    console.log();
    console.log('=== Summary ===');
    console.log(`Total:    ${rows.length}`);
    console.log(`Imported: ${imported}`);
    console.log(`Skipped:  ${skipped} (already had audio)`);
    console.log(`Failed:   ${failed}`);
    console.log(`Meditation scripts seeded: ${meditationSeeded}`);

  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
