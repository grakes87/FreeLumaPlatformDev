import { execSync, spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Resolve the absolute path to ffmpeg at module load time.
 * Falls back to bare 'ffmpeg' if `which` fails (e.g. Windows).
 */
let ffmpegPath = 'ffmpeg';
try {
  ffmpegPath = execSync('which ffmpeg', { encoding: 'utf-8' }).trim();
} catch {
  // `which` not available or ffmpeg not found — try common locations
  try {
    execSync('/opt/homebrew/bin/ffmpeg -version', { stdio: 'ignore' });
    ffmpegPath = '/opt/homebrew/bin/ffmpeg';
  } catch {
    // Keep bare 'ffmpeg' and let spawn fail with a clear error
  }
}

/**
 * Compress a video buffer to 720×1280 portrait H.264 MP4 using FFmpeg.
 *
 * Handles any input orientation:
 * - Portrait input: scales down to 720×1280
 * - Landscape input: center-crops to 9:16 then scales to 720×1280
 * - Rotation metadata: FFmpeg auto-applies it before processing
 *
 * Output: H.264 / AAC MP4 with faststart for web streaming.
 */
export async function compressVideo(inputBuffer: Buffer): Promise<Buffer> {
  if (!inputBuffer || inputBuffer.byteLength === 0) {
    throw new Error('Empty video buffer — nothing to compress');
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const inputPath = join(tmpdir(), `creator-input-${id}.webm`);
  const outputPath = join(tmpdir(), `creator-output-${id}.mp4`);

  try {
    await writeFile(inputPath, inputBuffer);

    const inputSize = inputBuffer.byteLength;
    console.log(`[compressVideo] Input: ${(inputSize / 1024 / 1024).toFixed(1)} MB, ffmpeg: ${ffmpegPath}`);

    await runFFmpeg(inputPath, outputPath);

    const outputBuffer = await readFile(outputPath);
    const outputSize = outputBuffer.byteLength;
    const ratio = ((1 - outputSize / inputSize) * 100).toFixed(0);
    console.log(
      `[compressVideo] Output: ${(outputSize / 1024 / 1024).toFixed(1)} MB (${ratio}% reduction)`
    );

    return outputBuffer;
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

function runFFmpeg(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      // Scale to fit 720x1280 (overshooting if needed), then center-crop to exact size.
      '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280',
      // H.264 encoding
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-maxrate', '3000k',
      '-bufsize', '6000k',
      // AAC audio
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ac', '2',
      // Web-optimized MP4
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ];

    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    // Collect last 2KB of stderr for error reporting (FFmpeg can write a lot)
    let stderrTail = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-2048);
    });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('FFmpeg timed out after 120s'));
    }, 120_000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const detail = stderrTail.split('\n').filter(l => l.trim()).slice(-5).join(' | ');
        console.error(`[compressVideo] FFmpeg exited with code ${code}:\n${stderrTail}`);
        reject(new Error(`FFmpeg exited with code ${code}: ${detail}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      console.error('[compressVideo] FFmpeg spawn error:', err);
      reject(new Error(`FFmpeg failed to start: ${err.message}`));
    });
  });
}
