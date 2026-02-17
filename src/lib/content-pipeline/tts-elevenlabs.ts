/**
 * ElevenLabs TTS Module
 *
 * Generates English speech audio from text using the ElevenLabs API.
 * Returns audio data as a Buffer along with character-level alignment
 * timestamps for SRT subtitle generation.
 *
 * Uses the official @elevenlabs/elevenlabs-js SDK with the
 * `convertWithTimestamps` method for character-level timing data.
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

/**
 * Character alignment data from ElevenLabs.
 * Matches the SDK's camelCase property names.
 */
export interface ElevenLabsAlignmentResult {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

/**
 * Result from ElevenLabs TTS generation.
 */
export interface ElevenLabsTtsResult {
  /** Raw audio data (MP3 format) */
  audioBuffer: Buffer;
  /** Character-level timing alignment for SRT generation */
  alignment: ElevenLabsAlignmentResult;
}

/**
 * Custom error for rate limiting (429 responses).
 * Includes retryAfter hint if the API provides one.
 */
export class ElevenLabsRateLimitError extends Error {
  retryAfterSeconds: number | null;

  constructor(message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'ElevenLabsRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Generate speech audio with character-level timestamps via ElevenLabs SDK.
 *
 * Uses the `textToSpeech.convertWithTimestamps` SDK method which returns
 * base64-encoded audio and character alignment data in a single call.
 *
 * Falls back to direct REST API call if the SDK method is unavailable.
 *
 * @param text - Text to convert to speech
 * @param voiceId - ElevenLabs voice ID
 * @param apiKey - ElevenLabs API key
 * @returns Audio buffer and character alignment data
 * @throws ElevenLabsRateLimitError on 429 responses
 * @throws Error on other API errors
 */
export async function generateTtsElevenLabs(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<ElevenLabsTtsResult> {
  // Try the SDK approach first
  try {
    return await generateViaSdk(text, voiceId, apiKey);
  } catch (sdkError: unknown) {
    // If SDK method works but returned a rate limit, re-throw that specifically
    if (sdkError instanceof ElevenLabsRateLimitError) {
      throw sdkError;
    }

    // If SDK method failed for structural reasons (method not found, etc.),
    // fall back to REST
    console.warn(
      '[tts-elevenlabs] SDK method failed, falling back to REST:',
      sdkError instanceof Error ? sdkError.message : sdkError
    );
    return await generateViaRest(text, voiceId, apiKey);
  }
}

/**
 * Generate TTS using the ElevenLabs SDK.
 */
async function generateViaSdk(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<ElevenLabsTtsResult> {
  const client = new ElevenLabsClient({ apiKey });

  const response = await client.textToSpeech.convertWithTimestamps(voiceId, {
    text,
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
  });

  if (!response.audioBase64) {
    throw new Error('ElevenLabs SDK response missing audioBase64 field.');
  }

  const alignment = response.alignment;
  if (!alignment) {
    throw new Error(
      'ElevenLabs SDK response missing alignment data. ' +
      'Ensure convertWithTimestamps is used (not convert).'
    );
  }

  return {
    audioBuffer: Buffer.from(response.audioBase64, 'base64'),
    alignment: {
      characters: alignment.characters,
      characterStartTimesSeconds: alignment.characterStartTimesSeconds,
      characterEndTimesSeconds: alignment.characterEndTimesSeconds,
    },
  };
}

/**
 * Fallback: Generate TTS using direct REST API call.
 */
async function generateViaRest(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<ElevenLabsTtsResult> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
    }),
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    throw new ElevenLabsRateLimitError(
      'ElevenLabs rate limit exceeded.',
      retryAfter ? parseInt(retryAfter, 10) : null
    );
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'unknown error');
    throw new Error(
      `ElevenLabs API error ${res.status}: ${errorBody}`
    );
  }

  const data = await res.json() as {
    audio_base64?: string;
    alignment?: {
      characters?: string[];
      character_start_times_seconds?: number[];
      character_end_times_seconds?: number[];
    };
  };

  if (!data.audio_base64) {
    throw new Error('ElevenLabs REST response missing audio_base64 field.');
  }

  const alignment = data.alignment;
  if (
    !alignment ||
    !alignment.characters ||
    !alignment.character_start_times_seconds ||
    !alignment.character_end_times_seconds
  ) {
    throw new Error(
      'ElevenLabs REST response missing alignment data.'
    );
  }

  return {
    audioBuffer: Buffer.from(data.audio_base64, 'base64'),
    alignment: {
      characters: alignment.characters,
      characterStartTimesSeconds: alignment.character_start_times_seconds,
      characterEndTimesSeconds: alignment.character_end_times_seconds,
    },
  };
}
