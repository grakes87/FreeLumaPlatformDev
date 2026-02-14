import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import sharp from 'sharp';
import { Writable } from 'stream';

// Set the ffmpeg binary path from ffmpeg-static
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
}

/**
 * Extract a thumbnail frame from a video at a given percentage position.
 *
 * Uses ffmpeg to capture a single frame, then processes it with sharp
 * to resize and convert to webp format.
 *
 * @param videoUrl - Public URL of the video file
 * @param seekPercent - Percentage of video duration to seek to (0-100, default 10)
 * @returns WebP buffer of the thumbnail, or null if extraction fails
 */
export async function extractThumbnail(
  videoUrl: string,
  seekPercent: number = 10
): Promise<Buffer | null> {
  try {
    // First, probe the video to get duration
    const duration = await getVideoDuration(videoUrl);
    const seekTime = duration > 0 ? (duration * seekPercent) / 100 : 1;

    // Extract a single frame as MJPEG
    const frameBuffer = await extractFrame(videoUrl, seekTime);
    if (!frameBuffer || frameBuffer.length === 0) {
      console.error('[Thumbnail] Empty frame buffer from ffmpeg');
      return null;
    }

    // Process with sharp: resize to 640x360 (16:9) and convert to webp
    const thumbnail = await sharp(frameBuffer)
      .resize(640, 360, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    console.error('[Thumbnail] Failed to extract thumbnail:', error);
    return null;
  }
}

/**
 * Get the duration of a video in seconds.
 */
function getVideoDuration(videoUrl: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoUrl, (err, metadata) => {
      if (err || !metadata?.format?.duration) {
        // Default to 0 if we can't get duration
        resolve(0);
        return;
      }
      resolve(metadata.format.duration);
    });
  });
}

/**
 * Extract a single frame from a video at the given timestamp.
 */
function extractFrame(videoUrl: string, seekTime: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];

    const writable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    ffmpeg(videoUrl)
      .seekInput(seekTime)
      .frames(1)
      .outputFormat('image2')
      .outputOptions(['-vcodec', 'mjpeg'])
      .on('error', (err) => {
        console.error('[Thumbnail] ffmpeg frame extraction error:', err.message);
        resolve(null);
      })
      .on('end', () => {
        if (chunks.length === 0) {
          resolve(null);
          return;
        }
        resolve(Buffer.concat(chunks));
      })
      .pipe(writable, { end: true });
  });
}
