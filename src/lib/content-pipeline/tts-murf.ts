/**
 * Murf TTS Module
 *
 * Generates speech audio (primarily for Spanish/non-English) via the
 * Murf REST API. Returns audio data as a Buffer along with word-level
 * duration data for SRT subtitle generation.
 *
 * Murf does not have an official Node.js SDK, so this uses direct
 * REST calls to the Murf v1 API.
 */

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
 * Generate speech audio with word-level timing via Murf REST API.
 *
 * Calls the Murf speech generation endpoint, downloads the generated
 * audio from the returned URL, and normalizes the word duration data.
 *
 * @param text - Text to convert to speech
 * @param voiceId - Murf voice ID (e.g., "en-US-natalie")
 * @param apiKey - Murf API key
 * @returns Audio buffer and word duration data
 * @throws Error on API errors or missing response fields
 */
export async function generateTtsMurf(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<MurfTtsResult> {
  const url = 'https://api.murf.ai/v1/speech/generate';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voiceId,
      format: 'MP3',
    }),
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

  // Validate required fields
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

  // Normalize word durations (handle missing or different formats)
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

  return {
    audioBuffer,
    wordDurations,
  };
}
