import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { existsSync } from 'fs';
import { Writable } from 'stream';

// Set ffmpeg binary: prefer ffmpeg-static if it exists, else fall back to system PATH
if (ffmpegStatic && existsSync(ffmpegStatic)) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Whether OpenAI API is configured for caption generation.
 */
export const isCaptionConfigured = Boolean(OPENAI_API_KEY);

/**
 * Generate WebVTT captions from a video's audio track using OpenAI Whisper.
 *
 * Uses null client pattern: returns null gracefully when OPENAI_API_KEY is not set.
 *
 * @param videoUrl - Public URL of the video file
 * @returns WebVTT caption string, or null if not configured or on failure
 */
export async function generateCaptions(
  videoUrl: string
): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.info('[Captions] OPENAI_API_KEY not set, skipping caption generation');
    return null;
  }

  try {
    // Extract audio track from video using ffmpeg
    const audioBuffer = await extractAudio(videoUrl);
    if (!audioBuffer || audioBuffer.length === 0) {
      console.error('[Captions] Failed to extract audio from video');
      return null;
    }

    // Create a File-like object for the OpenAI API
    const audioFile = new File([new Uint8Array(audioBuffer)], 'audio.mp3', {
      type: 'audio/mpeg',
    });

    // Lazy-import openai to avoid loading the library when not configured
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      response_format: 'vtt',
    });

    // Whisper with vtt format returns the VTT content as a string
    const vttContent = transcription as unknown as string;

    if (!vttContent || typeof vttContent !== 'string') {
      console.error('[Captions] Unexpected Whisper response format');
      return null;
    }

    return vttContent;
  } catch (error) {
    console.error('[Captions] Failed to generate captions:', error);
    return null;
  }
}

/**
 * Extract audio from a video file as MP3 using ffmpeg.
 */
function extractAudio(videoUrl: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];

    const writable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    ffmpeg(videoUrl)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate(64)
      .audioChannels(1)
      .outputFormat('mp3')
      .on('error', (err) => {
        console.error('[Captions] ffmpeg audio extraction error:', err.message);
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
