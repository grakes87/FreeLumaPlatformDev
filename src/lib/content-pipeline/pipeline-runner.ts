/**
 * Content Pipeline Runner
 *
 * Central orchestrator that generates a complete day of bible or positivity content.
 * Calls verse selection, AI text generation, TTS, and SRT modules in the correct
 * order, creates/updates DailyContent + DailyContentTranslation rows, uploads
 * audio/SRT files to B2, and reports progress.
 *
 * Key behaviors:
 * - Idempotent: skips existing data, only fills gaps
 * - Progress callbacks at each step for real-time UI feedback
 * - Used verses recorded only after successful content creation
 * - Rate limiting delays between API calls (ESV 200ms, TTS 500ms)
 */

import { Op } from 'sequelize';
import { PutObjectCommand } from '@aws-sdk/client-s3';

import { selectRandomUnusedVerse } from './verse-selection.js';
import {
  generatePositivityQuote,
  generateDevotionalReflection,
  generateCameraScript,
  generateMeditationScript,
  generateBackgroundPrompt,
} from './text-generation.js';
import { generateTtsElevenLabs } from './tts-elevenlabs.js';
import { generateTtsMurf } from './tts-murf.js';
import {
  generateSrt,
  characterAlignmentToWords,
  murfDurationsToWords,
} from './srt-generator.js';
import { fetchPassage } from '@/lib/bible-api/index.js';
import { getPublicUrl } from '@/lib/storage/presign.js';
import { b2Client, B2_BUCKET, isB2Configured } from '@/lib/storage/b2.js';

import type { VerseReference } from './bible-verse-index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProgressCallback = (event: ProgressEvent) => void;

export interface ProgressEvent {
  type: 'progress' | 'error' | 'complete';
  day?: number;
  total?: number;
  step?: string;
  message?: string;
  error?: string;
}

export interface DayResult {
  success: boolean;
  error?: string;
}

export interface MonthResult {
  generated: number;
  failed: number;
  skipped: number;
  failedDays: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Delay for rate limiting between API calls.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload a Buffer to B2 via direct PutObject (server-side upload).
 *
 * @param buffer  - File contents
 * @param key     - B2 object key (e.g., "daily-content-audio/2026-03-01/KJV.mp3")
 * @param contentType - MIME type
 * @returns Public CDN URL
 */
async function uploadBufferToB2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  if (!isB2Configured || !b2Client) {
    throw new Error('B2 storage is not configured. Cannot upload audio.');
  }

  await b2Client.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return getPublicUrl(key);
}

/**
 * Upload a string (SRT content) to B2 as a UTF-8 file.
 *
 * @param content     - String content to upload
 * @param key         - B2 object key
 * @param contentType - MIME type (typically "application/x-subrip")
 * @returns Public CDN URL
 */
async function uploadStringToB2(
  content: string,
  key: string,
  contentType: string
): Promise<string> {
  const buffer = Buffer.from(content, 'utf-8');
  return uploadBufferToB2(buffer, key, contentType);
}

// ---------------------------------------------------------------------------
// generateDayContent
// ---------------------------------------------------------------------------

/**
 * Generate a complete day of content for the given date and mode.
 *
 * Idempotent: checks each field individually. Re-running only fills missing
 * fields and never overwrites existing data.
 *
 * Steps:
 * 1. Find or create DailyContent row
 * 2. Bible: select verse + fetch translations / Positivity: generate quote
 * 3. Generate AI text (devotional, camera script, meditation, background prompt)
 * 4. Generate TTS audio + SRT subtitles for each translation
 * 5. Record used verse (bible only, after successful creation)
 * 6. Update status
 *
 * @param date       - Date string (YYYY-MM-DD)
 * @param mode       - Content mode ("bible" or "positivity")
 * @param onProgress - Callback for progress events
 * @returns Success/failure result
 */
export async function generateDayContent(
  date: string,
  mode: 'bible' | 'positivity',
  onProgress: ProgressCallback
): Promise<DayResult> {
  // Dynamic imports to avoid circular deps and allow lazy DB init
  const {
    DailyContent,
    DailyContentTranslation,
    BibleTranslation,
    UsedBibleVerse,
    PlatformSetting,
  } = await import('@/lib/db/models/index.js');

  let selectedVerse: VerseReference | null = null;

  try {
    // -----------------------------------------------------------------------
    // Step 1: Find or create DailyContent row
    // -----------------------------------------------------------------------
    let content = await DailyContent.findOne({
      where: { post_date: date, mode, language: 'en' },
    });

    if (!content) {
      content = await DailyContent.create({
        post_date: date,
        mode,
        language: 'en',
        title: '',
        content_text: '',
        video_background_url: '',
        status: 'empty',
      });
      onProgress({
        type: 'progress',
        step: 'create_row',
        message: `Created DailyContent row for ${date} (${mode})`,
      });
    } else {
      onProgress({
        type: 'progress',
        step: 'existing_row',
        message: `Found existing DailyContent row for ${date} (${mode}) — checking for gaps`,
      });
    }

    // -----------------------------------------------------------------------
    // Step 2a: Bible mode — verse selection
    // -----------------------------------------------------------------------
    if (mode === 'bible' && !content.verse_reference) {
      selectedVerse = await selectRandomUnusedVerse();

      // Fetch KJV text from the bible-verse-index (the reference string is
      // the display form, e.g., "John 3:16"). The KJV text comes from the
      // verse index itself — but we only have reference, book, chapter, verse.
      // We use fetchPassage to get the actual KJV verse text.
      const kjvText = await fetchPassage(
        selectedVerse.reference,
        'KJV',
        'verse'
      );

      await content.update({
        verse_reference: selectedVerse.reference,
        content_text: kjvText || `[${selectedVerse.reference}]`,
        title: selectedVerse.reference,
      });

      onProgress({
        type: 'progress',
        step: 'verse_selection',
        message: `Selected verse: ${selectedVerse.reference}`,
      });
    }

    // -----------------------------------------------------------------------
    // Step 2b: Bible mode — fetch all translations
    // -----------------------------------------------------------------------
    if (mode === 'bible' && content.verse_reference) {
      const activeTranslations = await BibleTranslation.findAll({
        where: { active: true },
      });

      for (const translation of activeTranslations) {
        // Check if DailyContentTranslation row exists with chapter_text
        const existing = await DailyContentTranslation.findOne({
          where: {
            daily_content_id: content.id,
            translation_code: translation.code,
          },
        });

        if (existing && existing.translated_text) {
          // Already have this translation
          continue;
        }

        // Fetch the verse for this translation
        const verseText = await fetchPassage(
          content.verse_reference,
          translation.code,
          'verse'
        );

        // ESV rate limiting: 200ms delay
        if (translation.code.toUpperCase() === 'ESV') {
          await delay(200);
        }

        if (verseText) {
          if (existing) {
            await existing.update({
              translated_text: verseText,
              verse_reference: content.verse_reference,
            });
          } else {
            await DailyContentTranslation.create({
              daily_content_id: content.id,
              translation_code: translation.code,
              translated_text: verseText,
              verse_reference: content.verse_reference,
              source: 'api',
            });
          }

          onProgress({
            type: 'progress',
            step: 'translation_fetch',
            message: `Fetched ${translation.code} translation`,
          });
        } else {
          onProgress({
            type: 'progress',
            step: 'translation_skip',
            message: `Skipped ${translation.code} — no text returned from API`,
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 2c: Positivity mode — generate quote
    // -----------------------------------------------------------------------
    if (mode === 'positivity' && !content.content_text) {
      const quote = await generatePositivityQuote();

      await content.update({
        content_text: quote,
        title: quote.substring(0, 100),
      });

      // Create a single English "translation" row for TTS later
      const existing = await DailyContentTranslation.findOne({
        where: {
          daily_content_id: content.id,
          translation_code: 'EN',
        },
      });

      if (!existing) {
        await DailyContentTranslation.create({
          daily_content_id: content.id,
          translation_code: 'EN',
          translated_text: quote,
          source: 'database',
        });
      }

      onProgress({
        type: 'progress',
        step: 'positivity_quote',
        message: 'Generated positivity quote',
      });
    }

    // Reload content to get latest field values
    await content.reload();

    // -----------------------------------------------------------------------
    // Step 3: Generate AI text (fill missing fields)
    // -----------------------------------------------------------------------
    const textContent = {
      verseReference: content.verse_reference ?? undefined,
      verseText: content.content_text || undefined,
      quote: mode === 'positivity' ? content.content_text || undefined : undefined,
    };

    const textUpdates: Record<string, string> = {};

    // Devotional reflection (bible mode only)
    if (
      mode === 'bible' &&
      !content.devotional_reflection &&
      content.verse_reference &&
      content.content_text
    ) {
      const reflection = await generateDevotionalReflection(
        content.verse_reference,
        content.content_text
      );
      textUpdates.devotional_reflection = reflection;
      onProgress({
        type: 'progress',
        step: 'devotional_reflection',
        message: 'Generated devotional reflection',
      });
    }

    // Camera script (both modes)
    if (!content.camera_script && content.content_text) {
      const script = await generateCameraScript(mode, textContent);
      textUpdates.camera_script = script;
      onProgress({
        type: 'progress',
        step: 'camera_script',
        message: 'Generated camera script',
      });
    }

    // Meditation script (both modes)
    if (!content.meditation_script && content.content_text) {
      const meditation = await generateMeditationScript(mode, textContent);
      textUpdates.meditation_script = meditation;
      onProgress({
        type: 'progress',
        step: 'meditation_script',
        message: 'Generated meditation script',
      });
    }

    // Background prompt (both modes)
    if (!content.background_prompt && content.content_text) {
      const bgPrompt = await generateBackgroundPrompt(mode, textContent);
      textUpdates.background_prompt = bgPrompt;
      onProgress({
        type: 'progress',
        step: 'background_prompt',
        message: 'Generated background video prompt',
      });
    }

    // Apply all text updates at once
    if (Object.keys(textUpdates).length > 0) {
      await content.update(textUpdates);
    }

    // -----------------------------------------------------------------------
    // Step 4: TTS audio + SRT subtitles
    // -----------------------------------------------------------------------
    if (isB2Configured) {
      const elevenLabsApiKey = await PlatformSetting.get('elevenlabs_api_key');
      const elevenLabsVoiceId = await PlatformSetting.get('elevenlabs_voice_id');
      const murfApiKey = await PlatformSetting.get('murf_api_key');
      const murfVoiceId = await PlatformSetting.get('murf_voice_id');

      // Find translations that have text but no audio
      const translationsNeedingAudio = await DailyContentTranslation.findAll({
        where: {
          daily_content_id: content.id,
          translated_text: { [Op.ne]: '' },
          audio_url: null,
        },
      });

      for (const translation of translationsNeedingAudio) {
        const ttsText = translation.translated_text;
        if (!ttsText) continue;

        try {
          // Look up the BibleTranslation to determine language
          const btRecord = await BibleTranslation.findOne({
            where: { code: translation.translation_code },
          });
          const language = btRecord?.language ?? 'en';

          // Determine TTS provider based on language
          const isEnglish =
            language.startsWith('en') ||
            translation.translation_code === 'EN';

          let audioBuffer: Buffer;
          let srtContent: string;

          if (isEnglish && elevenLabsApiKey && elevenLabsVoiceId) {
            // ElevenLabs for English
            const result = await generateTtsElevenLabs(
              ttsText,
              elevenLabsVoiceId,
              elevenLabsApiKey
            );
            audioBuffer = result.audioBuffer;

            // Convert character alignment to word timing then SRT
            const wordTimings = characterAlignmentToWords(result.alignment);
            srtContent = generateSrt(wordTimings);
          } else if (murfApiKey && murfVoiceId) {
            // Murf for Spanish/other
            const result = await generateTtsMurf(ttsText, murfVoiceId, murfApiKey);
            audioBuffer = result.audioBuffer;

            // Convert Murf word durations to SRT
            const wordTimings = murfDurationsToWords(result.wordDurations);
            srtContent = generateSrt(wordTimings);
          } else {
            onProgress({
              type: 'progress',
              step: 'tts_skip',
              message: `No TTS provider configured for ${translation.translation_code} (${language})`,
            });
            continue;
          }

          // Upload audio to B2
          const audioKey = `daily-content-audio/${date}/${translation.translation_code}.mp3`;
          const audioUrl = await uploadBufferToB2(
            audioBuffer,
            audioKey,
            'audio/mpeg'
          );

          // Upload SRT to B2
          const srtKey = `daily-content-audio/${date}/${translation.translation_code}.srt`;
          const srtUrl = await uploadStringToB2(
            srtContent,
            srtKey,
            'application/x-subrip'
          );

          // Update translation record
          await translation.update({
            audio_url: audioUrl,
            audio_srt_url: srtUrl,
          });

          onProgress({
            type: 'progress',
            step: 'tts_complete',
            message: `Generated TTS + SRT for ${translation.translation_code}`,
          });

          // Rate limit: 500ms between TTS calls
          await delay(500);
        } catch (ttsError) {
          const errMsg =
            ttsError instanceof Error ? ttsError.message : String(ttsError);
          onProgress({
            type: 'error',
            step: 'tts_error',
            message: `TTS failed for ${translation.translation_code}: ${errMsg}`,
            error: errMsg,
          });
          // Continue with other translations — don't abort the whole day
        }
      }
    } else {
      onProgress({
        type: 'progress',
        step: 'tts_skip',
        message: 'B2 storage not configured — skipping TTS audio generation',
      });
    }

    // -----------------------------------------------------------------------
    // Step 5: Record used verse (bible mode only)
    // -----------------------------------------------------------------------
    if (mode === 'bible' && selectedVerse) {
      // Only record if we selected a NEW verse in step 2
      // Check if already recorded (idempotency safety)
      const alreadyRecorded = await UsedBibleVerse.findOne({
        where: {
          book: selectedVerse.book,
          chapter: selectedVerse.chapter,
          verse: selectedVerse.verse,
        },
      });

      if (!alreadyRecorded) {
        await UsedBibleVerse.create({
          book: selectedVerse.book,
          chapter: selectedVerse.chapter,
          verse: selectedVerse.verse,
          verse_reference: selectedVerse.reference,
          used_date: date,
          daily_content_id: content.id,
        });

        onProgress({
          type: 'progress',
          step: 'verse_recorded',
          message: `Recorded ${selectedVerse.reference} as used`,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Step 6: Update status
    // -----------------------------------------------------------------------
    // Only upgrade status from 'empty' to 'generated'.
    // Do NOT downgrade from 'assigned', 'submitted', 'approved', etc.
    await content.reload();
    if (content.status === 'empty') {
      await content.update({ status: 'generated' });
      onProgress({
        type: 'progress',
        step: 'status_update',
        message: `Status updated to "generated"`,
      });
    }

    return { success: true };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[pipeline-runner] Failed to generate ${mode} for ${date}:`, error);
    onProgress({
      type: 'error',
      step: 'fatal',
      message: `Pipeline failed for ${date}: ${errMsg}`,
      error: errMsg,
    });
    return { success: false, error: errMsg };
  }
}

// ---------------------------------------------------------------------------
// generateMonthContent
// ---------------------------------------------------------------------------

/**
 * Generate content for every day of a given month.
 *
 * Loops day 1 to daysInMonth, calling generateDayContent for each.
 * Tracks success/failure/skip counts and failed day dates.
 *
 * @param month      - Month string (YYYY-MM)
 * @param mode       - Content mode ("bible" or "positivity")
 * @param onProgress - Callback for progress events
 * @returns Summary of generation results
 */
export async function generateMonthContent(
  month: string,
  mode: 'bible' | 'positivity',
  onProgress: ProgressCallback
): Promise<MonthResult> {
  // Parse YYYY-MM to determine days in month
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    onProgress({
      type: 'error',
      step: 'parse_month',
      message: `Invalid month format: "${month}". Expected YYYY-MM.`,
      error: `Invalid month format: "${month}"`,
    });
    return { generated: 0, failed: 1, skipped: 0, failedDays: [month] };
  }

  // Get the number of days in this month
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  let generated = 0;
  let failed = 0;
  const skipped = 0;
  const failedDays: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    onProgress({
      type: 'progress',
      day,
      total: daysInMonth,
      step: 'starting',
      message: `Starting day ${day}/${daysInMonth}: ${date}`,
    });

    const dayResult = await generateDayContent(date, mode, (dayEvent) => {
      // Forward day-level progress with day/total context
      onProgress({
        ...dayEvent,
        day,
        total: daysInMonth,
      });
    });

    if (dayResult.success) {
      generated++;
    } else {
      failed++;
      failedDays.push(date);
    }
  }

  onProgress({
    type: 'complete',
    step: 'month_complete',
    message: `Month ${month} complete: ${generated} generated, ${failed} failed`,
  });

  return { generated, failed, skipped, failedDays };
}
