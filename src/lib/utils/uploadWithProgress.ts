/**
 * Upload a file via presigned URL directly to B2, bypassing Cloudflare/Nginx.
 * Uses XMLHttpRequest for upload progress events.
 *
 * Flow:
 * 1. GET /api/upload/post-media?contentType=... → presigned PUT URL + key + public_url
 * 2. PUT directly to B2 with the file
 */

interface UploadResult {
  key: string;
  public_url: string;
}

export async function uploadWithProgress(
  file: File,
  onProgress: (percent: number) => void
): Promise<UploadResult> {
  const contentType = file.type || 'application/octet-stream';

  // Step 1: Get presigned URL
  const presignRes = await fetch(
    `/api/upload/post-media?contentType=${encodeURIComponent(contentType)}`,
    { credentials: 'include' }
  );
  if (!presignRes.ok) {
    const data = await presignRes.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to prepare upload');
  }
  const { upload_url, key, public_url } = await presignRes.json();

  // Step 2: Upload directly to B2 with progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 95);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve({ key, public_url });
      } else {
        reject(new Error(`Upload to storage failed (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.open('PUT', upload_url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('Cache-Control', 'public, max-age=31536000, immutable');
    xhr.timeout = 120000; // 2 min
    xhr.send(file);
  });
}
