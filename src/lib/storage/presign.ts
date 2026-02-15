import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { b2Client, B2_BUCKET, CDN_BASE_URL, isB2Configured } from './b2';

/**
 * Generate a presigned PUT URL for uploading a file to B2.
 *
 * @param key - The object key (path) in the bucket
 * @param contentType - MIME type of the file
 * @param expiresIn - URL expiry in seconds (default 3600 = 1 hour)
 * @returns Presigned upload URL
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  if (!isB2Configured || !b2Client) {
    throw new Error('B2 storage is not configured');
  }

  const command = new PutObjectCommand({
    Bucket: B2_BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  return getSignedUrl(b2Client, command, { expiresIn });
}

/**
 * Generate a presigned GET URL for downloading a private file from B2.
 *
 * @param key - The object key (path) in the bucket
 * @param expiresIn - URL expiry in seconds (default 3600 = 1 hour)
 * @returns Presigned download URL
 */
export async function getDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  if (!isB2Configured || !b2Client) {
    throw new Error('B2 storage is not configured');
  }

  const command = new GetObjectCommand({
    Bucket: B2_BUCKET,
    Key: key,
  });

  return getSignedUrl(b2Client, command, { expiresIn });
}

/**
 * Get the public CDN URL for a file.
 * Used for publicly accessible files like avatars.
 *
 * @param key - The object key (path) in the bucket
 * @returns Public URL via CDN or direct B2 URL
 */
export function getPublicUrl(key: string): string {
  if (!CDN_BASE_URL) {
    throw new Error('B2 storage is not configured');
  }
  return `${CDN_BASE_URL}/${key}`;
}

/**
 * Generate a unique object key for an upload.
 *
 * Format: {type}/{userId}/{timestamp}-{random}.{ext}
 * Example: avatars/123/1707600000000-a1b2c3.webp
 *
 * @param type - Upload type (e.g., 'avatars', 'daily-content')
 * @param userId - User's ID
 * @param contentType - MIME type to determine file extension
 * @returns Unique object key
 */
export function generateKey(
  type: string,
  userId: number,
  contentType: string
): string {
  const ext = getExtensionFromMime(contentType);
  const random = Math.random().toString(36).slice(2, 8);
  return `${type}/${userId}/${Date.now()}-${random}.${ext}`;
}

/**
 * Map MIME types to file extensions.
 */
function getExtensionFromMime(contentType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'video/3gpp': '3gp',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
  };

  return mimeToExt[contentType] || contentType.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin';
}
