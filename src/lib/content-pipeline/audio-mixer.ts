/**
 * Audio Mixer Module
 *
 * Mixes speech audio with background music using ffmpeg.
 * Background music is played at a low volume so speech remains clearly audible.
 * If the music is shorter than the speech, it loops; if longer, it's trimmed.
 *
 * Used for meditation audio to add ambient background music.
 */

import { execFile } from 'child_process';
import { writeFile, readFile, unlink, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

/** Volume reduction for background music in dB (negative = quieter). */
const MUSIC_VOLUME_DB = -18;

/** Path to background music directory. */
const BACKGROUND_MUSIC_DIR = resolve(process.cwd(), 'public/backgroundmusic');

/**
 * Pick a random background music file from the backgroundmusic directory.
 *
 * @returns Absolute path to a random .mp3 file
 * @throws Error if no music files found
 */
async function pickRandomMusic(): Promise<string> {
  const files = await readdir(BACKGROUND_MUSIC_DIR);
  const mp3Files = files.filter((f) => f.endsWith('.mp3'));

  if (mp3Files.length === 0) {
    throw new Error('No background music files found in public/backgroundmusic/');
  }

  const chosen = mp3Files[Math.floor(Math.random() * mp3Files.length)];
  return join(BACKGROUND_MUSIC_DIR, chosen);
}

/**
 * Run an ffmpeg command and return a promise.
 */
function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 120_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`ffmpeg error: ${error.message}\nstderr: ${stderr}`));
      } else {
        resolve(stderr); // ffmpeg outputs info to stderr
      }
    });
  });
}

/**
 * Mix speech audio with background music.
 *
 * The background music is:
 * - Looped if shorter than the speech
 * - Trimmed to match the speech duration
 * - Reduced in volume by MUSIC_VOLUME_DB dB
 *
 * @param speechBuffer - Raw MP3 audio buffer of the speech/meditation
 * @returns Mixed MP3 audio buffer with background music
 */
export async function mixWithBackgroundMusic(
  speechBuffer: Buffer
): Promise<Buffer> {
  const musicPath = await pickRandomMusic();

  // Create temp files
  const id = randomUUID().slice(0, 8);
  const tempDir = tmpdir();
  const speechPath = join(tempDir, `speech-${id}.mp3`);
  const outputPath = join(tempDir, `mixed-${id}.mp3`);

  try {
    // Write speech buffer to temp file
    await writeFile(speechPath, speechBuffer);

    // ffmpeg command:
    // -i speech.mp3           → input 0 (speech)
    // -stream_loop -1 -i music.mp3  → input 1 (music, looped infinitely)
    // -filter_complex:
    //   [1]volume=-18dB[bg]   → reduce music volume
    //   [0][bg]amix=inputs=2:duration=first  → mix, stop when speech ends
    // -ac 2                   → stereo output
    // -b:a 128k               → 128kbps output bitrate
    await runFfmpeg([
      '-y',
      '-i', speechPath,
      '-stream_loop', '-1',
      '-i', musicPath,
      '-filter_complex',
      `[1]volume=${MUSIC_VOLUME_DB}dB[bg];[0][bg]amix=inputs=2:duration=first:dropout_transition=2`,
      '-ac', '2',
      '-b:a', '128k',
      outputPath,
    ]);

    // Read the mixed output
    const mixedBuffer = await readFile(outputPath);
    return Buffer.from(mixedBuffer);
  } finally {
    // Clean up temp files
    await unlink(speechPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
