/**
 * Client-side video thumbnail generator using canvas API.
 * Captures a frame at 0.5s from a video File and returns it as a JPEG Blob.
 */

const THUMBNAIL_TIMEOUT_MS = 10_000;
const FALLBACK_WIDTH = 640;
const FALLBACK_HEIGHT = 360;
const SEEK_TIME = 0.5;
const JPEG_QUALITY = 0.7;

/**
 * Generate a JPEG thumbnail blob from a video File by capturing a frame at 0.5s.
 * Returns null if the video cannot be processed (corrupt, unsupported codec, timeout).
 */
export async function generateVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load(); // release resources
    };

    const finish = (result: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(result);
    };

    // Timeout guard to prevent hanging on corrupt videos
    const timer = setTimeout(() => {
      finish(null);
    }, THUMBNAIL_TIMEOUT_MS);

    video.onloadeddata = () => {
      video.currentTime = SEEK_TIME;
    };

    video.onseeked = () => {
      try {
        const width = video.videoWidth || FALLBACK_WIDTH;
        const height = video.videoHeight || FALLBACK_HEIGHT;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            finish(blob);
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      } catch {
        finish(null);
      }
    };

    video.onerror = () => {
      finish(null);
    };

    video.src = url;
  });
}

/**
 * Generate a JPEG thumbnail from a video URL by loading it and capturing a frame.
 * Returns { blob, dataUrl } on success, or null if capture fails (CORS, timeout, etc.).
 */
export async function generateThumbnailFromUrl(
  videoUrl: string
): Promise<{ blob: Blob; dataUrl: string } | null> {
  return new Promise<{ blob: Blob; dataUrl: string } | null>((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let settled = false;

    const finish = (result: { blob: Blob; dataUrl: string } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), THUMBNAIL_TIMEOUT_MS);

    video.onloadeddata = () => {
      video.currentTime = SEEK_TIME;
    };

    video.onseeked = () => {
      try {
        const width = video.videoWidth || FALLBACK_WIDTH;
        const height = video.videoHeight || FALLBACK_HEIGHT;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { finish(null); return; }
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        canvas.toBlob(
          (blob) => finish(blob ? { blob, dataUrl } : null),
          'image/jpeg',
          JPEG_QUALITY
        );
      } catch {
        finish(null);
      }
    };

    video.onerror = () => finish(null);
    video.src = videoUrl;
  });
}

/**
 * Convert a Blob to a data URL string for use in img src or video poster attributes.
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error('Failed to convert blob to data URL'));
    };
    reader.readAsDataURL(blob);
  });
}
