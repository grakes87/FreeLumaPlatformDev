import sharp from 'sharp';

export interface CompressImageOptions {
  /** Maximum width in pixels (default: 1200) */
  maxWidth?: number;
  /** WebP quality 1-100 (default: 85) */
  quality?: number;
}

export interface CompressImageResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
}

/**
 * Compress and convert an image to WebP format.
 * Resizes to maxWidth if wider, maintaining aspect ratio.
 */
export async function compressImage(
  inputBuffer: Buffer,
  options: CompressImageOptions = {}
): Promise<CompressImageResult> {
  const { maxWidth = 1200, quality = 85 } = options;

  let pipeline = sharp(inputBuffer);

  // Get original metadata for resize decision
  const metadata = await pipeline.metadata();
  const originalWidth = metadata.width ?? 0;

  // Resize only if wider than maxWidth
  if (originalWidth > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  // Convert to WebP
  const outputBuffer = await pipeline
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: outputBuffer.data,
    width: outputBuffer.info.width,
    height: outputBuffer.info.height,
    format: 'webp',
  };
}

/**
 * Generate a thumbnail from a video URL.
 * TODO: Implement video thumbnail generation (ffmpeg or background job).
 * For now returns null - video thumbnails can be handled client-side
 * or via a background processing queue in a later phase.
 */
export async function generateVideoThumbnail(
  _videoUrl: string
): Promise<Buffer | null> {
  // Stub: video thumbnail generation deferred to background job system
  return null;
}
