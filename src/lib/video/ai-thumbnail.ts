import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import sharp from 'sharp';
import { existsSync } from 'fs';
import { Writable } from 'stream';

// Set ffmpeg binary: prefer ffmpeg-static if it exists, else fall back to system PATH
if (ffmpegStatic && existsSync(ffmpegStatic)) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Whether AI thumbnail generation is available.
 */
export const isAiThumbnailConfigured = Boolean(OPENAI_API_KEY);

/**
 * Full AI thumbnail pipeline:
 * 1. Extract frames from video at regular intervals
 * 2. Send frames + description to GPT-4o vision for analysis
 * 3. Generate a custom thumbnail via OpenAI image generation
 *
 * @param videoUrl - Public URL of the video file
 * @param description - Video title/description for context
 * @returns WebP buffer of the AI-generated thumbnail, or null on failure
 */
export async function generateAiThumbnail(
  videoUrl: string,
  description: string
): Promise<Buffer | null> {
  if (!OPENAI_API_KEY) {
    console.info('[AI Thumbnail] OPENAI_API_KEY not set, skipping');
    return null;
  }

  try {
    // Step 1: Extract frames from the video
    const frames = await extractFrames(videoUrl);
    if (!frames || frames.length === 0) {
      console.error('[AI Thumbnail] No frames extracted');
      return null;
    }
    console.log(`[AI Thumbnail] Extracted ${frames.length} frames`);

    // Step 2: Analyze frames with GPT-4o vision
    const imagePrompt = await analyzeFrames(frames, description);
    if (!imagePrompt) {
      console.error('[AI Thumbnail] Vision analysis returned no prompt');
      return null;
    }
    console.log(`[AI Thumbnail] Generated image prompt (${imagePrompt.length} chars)`);

    // Step 3: Generate thumbnail image
    const thumbnailBuffer = await generateImage(imagePrompt);
    if (!thumbnailBuffer) {
      console.error('[AI Thumbnail] Image generation returned null');
      return null;
    }
    console.log(`[AI Thumbnail] Generated image (${thumbnailBuffer.length} bytes)`);

    // Step 4: Resize to 640x360 WebP (consistent with existing thumbnails)
    const finalBuffer = await sharp(thumbnailBuffer)
      .resize(640, 360, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    console.log(`[AI Thumbnail] Final WebP thumbnail: ${finalBuffer.length} bytes`);
    return finalBuffer;
  } catch (error) {
    console.error('[AI Thumbnail] Pipeline failed:', error);
    return null;
  }
}

/**
 * Extract frames from a video at regular intervals.
 * Captures one frame every `intervalSeconds`, capped at `maxFrames`.
 */
async function extractFrames(
  videoUrl: string,
  intervalSeconds: number = 15,
  maxFrames: number = 8
): Promise<Buffer[]> {
  const duration = await getVideoDuration(videoUrl);
  if (duration <= 0) {
    console.warn('[AI Thumbnail] Could not determine video duration');
    // Try at least one frame at 1s
    const frame = await extractSingleFrame(videoUrl, 1);
    return frame ? [frame] : [];
  }

  // Calculate timestamps: 0, 15, 30, ... up to duration
  const timestamps: number[] = [];
  for (let t = 0; t < duration && timestamps.length < maxFrames; t += intervalSeconds) {
    timestamps.push(t);
  }

  // If video is very short (<15s) and we only have t=0, add a mid-point
  if (timestamps.length === 1 && duration > 2) {
    timestamps.push(duration / 2);
  }

  console.log(`[AI Thumbnail] Extracting ${timestamps.length} frames from ${duration.toFixed(1)}s video`);

  const frames: Buffer[] = [];
  for (const ts of timestamps) {
    const frame = await extractSingleFrame(videoUrl, ts);
    if (frame) {
      // Resize to 512x288 to keep API payload small
      const resized = await sharp(frame)
        .resize(512, 288, { fit: 'cover' })
        .jpeg({ quality: 70 })
        .toBuffer();
      frames.push(resized);
    }
  }

  return frames;
}

/**
 * Get the duration of a video in seconds using ffprobe.
 */
function getVideoDuration(videoUrl: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoUrl, (err, metadata) => {
      if (err || !metadata?.format?.duration) {
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
function extractSingleFrame(videoUrl: string, seekTime: number): Promise<Buffer | null> {
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
        console.error(`[AI Thumbnail] ffmpeg frame extraction error at ${seekTime}s:`, err.message);
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

/**
 * Send frames + description to GPT-4o vision for analysis.
 * Returns a detailed image generation prompt.
 */
async function analyzeFrames(
  frames: Buffer[],
  description: string
): Promise<string | null> {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Build image content parts from frame buffers
  const imageContentParts = frames.map((frame) => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:image/jpeg;base64,${frame.toString('base64')}`,
      detail: 'low' as const,
    },
  }));

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content:
          'You are a thumbnail design consultant. Analyze these video screenshots and the description to create a detailed image generation prompt for a professional, eye-catching video thumbnail. ' +
          'Focus on the visual theme, mood, colors, key subjects, and composition. ' +
          'The thumbnail should NOT contain any text, words, letters, or numbers. ' +
          'Output ONLY the image generation prompt, nothing else.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Video description: "${description}"\n\nHere are screenshots from the video at regular intervals. Create a thumbnail generation prompt based on these:`,
          },
          ...imageContentParts,
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || null;
}

/**
 * Generate a thumbnail image using OpenAI image generation.
 * Returns raw image buffer.
 */
async function generateImage(prompt: string): Promise<Buffer | null> {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: `Professional video thumbnail, no text, no words, no letters, no numbers: ${prompt}`,
    n: 1,
    size: '1024x1024',
  });

  const imageData = response.data?.[0];
  if (!imageData) return null;

  // gpt-image-1 returns base64 by default
  if (imageData.b64_json) {
    return Buffer.from(imageData.b64_json, 'base64');
  }

  // Fallback: fetch from URL if returned
  if (imageData.url) {
    const res = await fetch(imageData.url);
    if (!res.ok) {
      console.error(`[AI Thumbnail] Failed to fetch generated image: ${res.status}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  }

  return null;
}
