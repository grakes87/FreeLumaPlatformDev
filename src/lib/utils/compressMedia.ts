/**
 * Client-side image compression using Canvas API.
 *
 * - Resizes images so the longest side is at most MAX_DIMENSION
 * - Converts to JPEG at the target quality (preserves GIFs as-is)
 * - Returns a new File object with the compressed data
 *
 * Videos are returned as-is (server/CDN should handle transcoding).
 */

const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.82;

/**
 * Compress an image file. Returns the original file if it's a GIF,
 * already small enough, or if compression fails.
 */
export async function compressImage(file: File): Promise<File> {
  // Skip GIFs (animated) and SVGs — can't compress meaningfully with Canvas
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  // Skip files already under 500KB — not worth compressing
  if (file.size < 500 * 1024) {
    return file;
  }

  try {
    // Create an image bitmap from the file (handles HEIC, HEIF, etc. on supported browsers)
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Calculate target dimensions (maintain aspect ratio)
    let targetW = width;
    let targetH = height;
    const longest = Math.max(width, height);

    if (longest > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / longest;
      targetW = Math.round(width * scale);
      targetH = Math.round(height * scale);
    }

    // Draw onto an OffscreenCanvas if available, fallback to regular Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    // Convert to blob — JPEG for photos, WebP as fallback
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        'image/jpeg',
        JPEG_QUALITY
      );
    });

    if (!blob || blob.size >= file.size) {
      // Compression didn't help — return original
      return file;
    }

    // Return as a new File with a .jpg extension
    const name = file.name.replace(/\.[^.]+$/, '.jpg');
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    // createImageBitmap may fail for unsupported formats on some browsers
    // Return the original file and let the server handle it
    return file;
  }
}

/**
 * Compress a media file before upload.
 * Images get resized + JPEG compressed.
 * Videos are returned as-is (too heavy for client-side transcoding).
 */
export async function compressMediaFile(file: File): Promise<File> {
  if (file.type.startsWith('image/')) {
    return compressImage(file);
  }
  // Videos: return as-is
  return file;
}
