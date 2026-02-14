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
      // B2 doesn't support AWS SDK v3 automatic checksums
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
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

/**
 * Ensure B2 bucket has CORS rules allowing browser PUT uploads.
 * Uses B2 native API since bucket has native CORS rules (S3 PutBucketCors rejected).
 * Runs once on first import, fire-and-forget.
 */
if (isB2Configured && b2Client) {
  const corsKey = '__b2CorsConfigured';
  if (!(globalThis as Record<string, unknown>)[corsKey]) {
    (globalThis as Record<string, unknown>)[corsKey] = true;

    (async () => {
      try {
        // Step 1: Authorize with B2 native API
        const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
          headers: {
            Authorization: `Basic ${Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64')}`,
          },
        });
        if (!authRes.ok) throw new Error(`B2 auth failed: ${authRes.status}`);
        const auth = await authRes.json();

        // Step 2: Get bucket ID
        const listRes = await fetch(`${auth.apiInfo.storageApi.apiUrl}/b2api/v3/b2_list_buckets`, {
          method: 'POST',
          headers: {
            Authorization: auth.authorizationToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: auth.accountId,
            bucketName: B2_BUCKET_NAME,
          }),
        });
        if (!listRes.ok) throw new Error(`B2 list buckets failed: ${listRes.status}`);
        const { buckets } = await listRes.json();
        const bucket = buckets?.[0];
        if (!bucket) throw new Error('Bucket not found');

        // Step 3: Check if CORS already has s3_put — skip update if so
        const existingCors = bucket.corsRules || [];
        const hasS3Put = existingCors.some(
          (r: { allowedOperations?: string[] }) => r.allowedOperations?.includes('s3_put')
        );

        if (hasS3Put) {
          console.log('[B2 Storage] CORS already configured with s3_put — skipping update');
          return;
        }

        // Step 4: Update bucket with CORS rules, preserving bucketType
        const updateRes = await fetch(`${auth.apiInfo.storageApi.apiUrl}/b2api/v3/b2_update_bucket`, {
          method: 'POST',
          headers: {
            Authorization: auth.authorizationToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: auth.accountId,
            bucketId: bucket.bucketId,
            bucketType: bucket.bucketType, // Preserve existing bucket type (allPublic)
            corsRules: [
              {
                corsRuleName: 'allowAllUploads',
                allowedOrigins: ['*'],
                allowedOperations: [
                  's3_put',
                  's3_get',
                  's3_head',
                  'b2_download_file_by_name',
                  'b2_download_file_by_id',
                  'b2_upload_file',
                  'b2_upload_part',
                ],
                allowedHeaders: ['*'],
                exposeHeaders: ['ETag', 'x-amz-request-id'],
                maxAgeSeconds: 86400,
              },
            ],
          }),
        });

        if (!updateRes.ok) {
          const errBody = await updateRes.text();
          throw new Error(`B2 update bucket failed: ${updateRes.status} ${errBody}`);
        }

        console.log('[B2 Storage] CORS rules configured for uploads (native API)');
      } catch (err) {
        console.warn('[B2 Storage] CORS config failed:', err);
      }
    })();
  }
}
