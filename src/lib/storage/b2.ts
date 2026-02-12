import { S3Client } from '@aws-sdk/client-s3';

const B2_REGION = process.env.B2_REGION;
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;

/**
 * Whether Backblaze B2 storage is configured.
 * When false, upload features gracefully degrade.
 */
export const isB2Configured =
  Boolean(B2_REGION) &&
  Boolean(B2_KEY_ID) &&
  Boolean(B2_APP_KEY) &&
  Boolean(B2_BUCKET_NAME);

if (!isB2Configured) {
  console.warn(
    '[B2 Storage] Missing environment variables (B2_REGION, B2_KEY_ID, B2_APP_KEY, B2_BUCKET_NAME). ' +
      'Upload features will be unavailable. Set these in .env.local to enable file uploads.'
  );
}

/**
 * S3-compatible client configured for Backblaze B2.
 * Only usable when isB2Configured is true.
 */
export const b2Client = isB2Configured
  ? new S3Client({
      endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
      region: B2_REGION!,
      credentials: {
        accessKeyId: B2_KEY_ID!,
        secretAccessKey: B2_APP_KEY!,
      },
    })
  : null;

/**
 * B2 bucket name for uploads.
 */
export const B2_BUCKET = B2_BUCKET_NAME ?? '';

/**
 * Base URL for serving public files.
 * Uses CDN_BASE_URL if configured (Cloudflare CNAME), otherwise falls back to B2 direct URL.
 */
export const CDN_BASE_URL =
  process.env.CDN_BASE_URL ||
  (B2_BUCKET_NAME
    ? `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}`
    : '');
