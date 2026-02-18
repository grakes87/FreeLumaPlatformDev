/**
 * Regenerate AI thumbnail for a video: generate → upload to B2 → update DB.
 * Usage: npx tsx scripts/regen-thumbnail.mts <videoId>
 */
import 'dotenv/config';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';

const videoId = parseInt(process.argv[2], 10);
if (!videoId) {
  console.error('Usage: npx tsx scripts/regen-thumbnail.mts <videoId>');
  process.exit(1);
}

const B2_REGION = process.env.B2_REGION;
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;
const CDN_BASE = process.env.CDN_BASE_URL || `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}`;

if (!B2_REGION || !B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_NAME) {
  console.error('Missing B2 env vars (B2_REGION, B2_KEY_ID, B2_APP_KEY, B2_BUCKET_NAME)');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not set');
  process.exit(1);
}

const b2 = new S3Client({
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  region: B2_REGION,
  credentials: { accessKeyId: B2_KEY_ID, secretAccessKey: B2_APP_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

(async () => {
  // 1. Get video from DB
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'freeluma_dev',
  });

  const [rows] = await conn.execute('SELECT id, title, description, video_url, thumbnail_url FROM videos WHERE id = ?', [videoId]) as any;
  if (!rows.length) {
    console.error(`Video ${videoId} not found`);
    process.exit(1);
  }
  const video = rows[0];
  console.log(`Video: "${video.title}" (ID ${video.id})`);
  console.log(`Current thumbnail: ${video.thumbnail_url}`);
  console.log(`Video URL: ${video.video_url}\n`);

  // 2. Run AI thumbnail pipeline
  const { generateAiThumbnail } = await import('../src/lib/video/ai-thumbnail.ts');
  const description = [video.title, video.description].filter(Boolean).join(' — ');

  console.log('Running AI thumbnail pipeline...');
  const thumbnailBuffer = await generateAiThumbnail(video.video_url, description);

  if (!thumbnailBuffer) {
    console.error('AI thumbnail generation failed');
    await conn.end();
    process.exit(1);
  }
  console.log(`\nGenerated thumbnail: ${thumbnailBuffer.length} bytes (${(thumbnailBuffer.length / 1024).toFixed(1)} KB)\n`);

  // 3. Upload to B2
  const thumbnailKey = `videos/thumbnails/${videoId}-thumb.webp`;
  console.log(`Uploading to B2: ${thumbnailKey}`);
  await b2.send(new PutObjectCommand({
    Bucket: B2_BUCKET_NAME,
    Key: thumbnailKey,
    Body: thumbnailBuffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  console.log('Upload complete');

  // 4. Update DB with cache-busted URL
  const newUrl = `${CDN_BASE}/${thumbnailKey}?v=${Date.now()}`;
  await conn.execute('UPDATE videos SET thumbnail_url = ? WHERE id = ?', [newUrl, videoId]);
  console.log(`\nDB updated with new URL: ${newUrl}`);

  await conn.end();
  console.log('\nDone! Thumbnail regenerated and live.');
})();
