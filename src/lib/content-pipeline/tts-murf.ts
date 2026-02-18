/**
 * Murf TTS Module
 *
 * Generates speech audio (primarily for Spanish/non-English) via the
 * Murf REST API. Returns audio data as a Buffer along with word-level
 * duration data for SRT subtitle generation.
 *
 * Automatically chunks text longer than 2800 characters at sentence
 * boundaries, generates TTS for each chunk, then concatenates the
 * audio buffers and merges word durations with correct time offsets.
 *
 * Murf does not have an official Node.js SDK, so this uses direct
 * REST calls to the Murf v1 API.
 */

const MURF_MAX_CHARS = 2800; // Leave margin below Murf's 3000 char limit

/**
 * Word duration entry from Murf API response.
 * Supports both start/end and duration-only formats.
 */
export interface MurfWordDurationEntry {
  word: string;
  start?: number;
  end?: number;
  duration?: number;
}

/**
 * Result from Murf TTS generation.
 */
export interface MurfTtsResult {
  /** Raw audio data (MP3 format) */
  audioBuffer: Buffer;
  /** Word-level duration data for SRT generation */
  wordDurations: MurfWordDurationEntry[];
}

/**
 * Split text into chunks that fit within Murf's character limit.
 * Splits at sentence boundaries (. ! ?) when possible, falls back
 * to word boundaries, then hard split as last resort.
 */
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    // Find last sentence boundary before limit
    let splitAt = -1;
    for (const delim of ['. ', '! ', '? ', '.\n', '!\n', '?\n']) {
      const idx = remaining.lastIndexOf(delim, maxChars);
      if (idx > splitAt && idx > 0) {
        splitAt = idx + delim.length;
      }
    }

    // Fallback: split at last space before limit
    if (splitAt <= 0) {
      splitAt = remaining.lastIndexOf(' ', maxChars);
    }

    // Last resort: hard split
    if (splitAt <= 0) {
      splitAt = maxChars;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

/**
 * Call Murf API for a single text chunk. Returns audio buffer and word durations.
 */
async function generateChunk(
  text: string,
  voiceId: string,
  apiKey: string,
  style?: string
): Promise<MurfTtsResult> {
  const url = 'https://api.murf.ai/v1/speech/generate';

  const body: Record<string, string> = {
    text,
    voiceId,
    format: 'MP3',
  };
  if (style) body.style = style;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'unknown error');
    throw new Error(
      `Murf API error ${res.status}: ${errorBody}`
    );
  }

  const data = await res.json() as {
    audioFile?: string;
    wordDurations?: Array<{
      word: string;
      start?: number;
      end?: number;
      duration?: number;
    }>;
  };

  if (!data.audioFile) {
    throw new Error(
      'Murf API response missing audioFile URL. ' +
      'Response keys: ' + Object.keys(data).join(', ')
    );
  }

  // Download audio from the URL
  const audioRes = await fetch(data.audioFile);
  if (!audioRes.ok) {
    throw new Error(
      `Failed to download Murf audio from ${data.audioFile}: ${audioRes.status}`
    );
  }

  const audioArrayBuffer = await audioRes.arrayBuffer();
  const audioBuffer = Buffer.from(audioArrayBuffer);

  // Normalize word durations
  const wordDurations: MurfWordDurationEntry[] = [];
  if (Array.isArray(data.wordDurations)) {
    for (const entry of data.wordDurations) {
      wordDurations.push({
        word: entry.word,
        ...(typeof entry.start === 'number' ? { start: entry.start } : {}),
        ...(typeof entry.end === 'number' ? { end: entry.end } : {}),
        ...(typeof entry.duration === 'number'
          ? { duration: entry.duration }
          : {}),
      });
    }
  }

  return { audioBuffer, wordDurations };
}

/**
 * Get the end time of the last word in a durations array (in seconds).
 * Used to calculate the time offset for the next chunk.
 */
function getChunkEndTime(durations: MurfWordDurationEntry[]): number {
  for (let i = durations.length - 1; i >= 0; i--) {
    const d = durations[i];
    if (typeof d.end === 'number') return d.end;
    if (typeof d.start === 'number' && typeof d.duration === 'number') {
      return d.start + d.duration;
    }
  }
  return 0;
}

/**
 * Generate speech audio with word-level timing via Murf REST API.
 *
 * Automatically chunks text that exceeds Murf's 3000 character limit,
 * generates TTS for each chunk sequentially, then concatenates the
 * audio buffers and merges word durations with correct time offsets.
 *
 * @param text - Text to convert to speech
 * @param voiceId - Murf voice ID (e.g., "en-US-ken", "es-MX-carlos")
 * @param apiKey - Murf API key
 * @param style - Optional voice style (e.g., "Calm", "Conversation")
 * @returns Audio buffer and word duration data
 * @throws Error on API errors or missing response fields
 */
export async function generateTtsMurf(
  text: string,
  voiceId: string,
  apiKey: string,
  style?: string
): Promise<MurfTtsResult> {
  const chunks = splitTextIntoChunks(text, MURF_MAX_CHARS);

  // Single chunk — no splitting needed
  if (chunks.length === 1) {
    return generateChunk(chunks[0], voiceId, apiKey, style);
  }

  // Multiple chunks — generate sequentially, concatenate results
  const audioBuffers: Buffer[] = [];
  const allDurations: MurfWordDurationEntry[] = [];
  let timeOffset = 0; // cumulative offset in seconds

  for (let i = 0; i < chunks.length; i++) {
    const result = await generateChunk(chunks[i], voiceId, apiKey, style);

    audioBuffers.push(result.audioBuffer);

    // Offset word durations by cumulative time from previous chunks
    for (const wd of result.wordDurations) {
      const entry: MurfWordDurationEntry = { word: wd.word };
      if (typeof wd.start === 'number') entry.start = wd.start + timeOffset;
      if (typeof wd.end === 'number') entry.end = wd.end + timeOffset;
      if (typeof wd.duration === 'number') entry.duration = wd.duration;
      allDurations.push(entry);
    }

    // Advance offset by this chunk's total audio duration
    timeOffset += getChunkEndTime(result.wordDurations);
  }

  return {
    audioBuffer: Buffer.concat(audioBuffers),
    wordDurations: allDurations,
  };
}
