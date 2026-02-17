import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const regenerateSchema = z.object({
  daily_content_id: z.number().int().positive(),
  field: z.enum([
    'camera_script',
    'devotional_reflection',
    'meditation_script',
    'background_prompt',
    'tts',
    'srt',
  ]),
  translation_code: z.string().min(1).optional(),
});

/**
 * POST /api/admin/content-production/regenerate
 *
 * Re-generates a specific field on a daily content record.
 * For text fields, calls the appropriate AI generation function.
 * For TTS/SRT, regenerates audio and subtitles for a specific translation.
 *
 * Body:
 *   daily_content_id: number
 *   field: 'camera_script' | 'devotional_reflection' | 'meditation_script' | 'background_prompt' | 'tts' | 'srt'
 *   translation_code?: string (required for tts/srt)
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContent, DailyContentTranslation, BibleTranslation, PlatformSetting } =
      await import('@/lib/db/models');

    const json = await req.json();
    const parsed = regenerateSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || 'Invalid input',
        400
      );
    }

    const { daily_content_id, field, translation_code } = parsed.data;

    // Validate translation_code is required for tts/srt
    if ((field === 'tts' || field === 'srt') && !translation_code) {
      return errorResponse('translation_code is required for tts/srt regeneration', 400);
    }

    // Find the content record
    const content = await DailyContent.findByPk(daily_content_id, {
      include: [
        {
          model: DailyContentTranslation,
          as: 'translations',
        },
      ],
    });

    if (!content) {
      return errorResponse('Daily content not found', 404);
    }

    // Handle text field regeneration
    if (
      field === 'camera_script' ||
      field === 'devotional_reflection' ||
      field === 'meditation_script' ||
      field === 'background_prompt'
    ) {
      const {
        generateCameraScript,
        generateDevotionalReflection,
        generateMeditationScript,
        generateBackgroundPrompt,
      } = await import('@/lib/content-pipeline/text-generation');

      const textContent = {
        verseReference: content.verse_reference ?? undefined,
        verseText: content.content_text || undefined,
        quote: content.mode === 'positivity' ? content.content_text || undefined : undefined,
      };

      let newValue: string;

      switch (field) {
        case 'camera_script':
          newValue = await generateCameraScript(content.mode, textContent);
          break;

        case 'devotional_reflection':
          if (content.mode !== 'bible') {
            return errorResponse('Devotional reflection is only for bible mode', 400);
          }
          newValue = await generateDevotionalReflection(
            content.verse_reference || '',
            content.content_text || ''
          );
          break;

        case 'meditation_script':
          newValue = await generateMeditationScript(content.mode, textContent);
          break;

        case 'background_prompt':
          newValue = await generateBackgroundPrompt(content.mode, textContent);
          break;
      }

      await content.update({ [field]: newValue! });
      await content.reload({
        include: [{ model: DailyContentTranslation, as: 'translations' }],
      });

      return successResponse({ content: content.toJSON() });
    }

    // Handle TTS/SRT regeneration
    if (field === 'tts' || field === 'srt') {
      const translation = await DailyContentTranslation.findOne({
        where: {
          daily_content_id,
          translation_code: translation_code!,
        },
      });

      if (!translation) {
        return errorResponse(
          `Translation not found: ${translation_code}`,
          404
        );
      }

      const ttsText = translation.translated_text;
      if (!ttsText) {
        return errorResponse(
          'No translated text available for TTS generation',
          400
        );
      }

      // Determine language and TTS provider
      const btRecord = await BibleTranslation.findOne({
        where: { code: translation_code! },
      });
      const language = btRecord?.language ?? 'en';
      const isEnglish =
        language.startsWith('en') ||
        translation_code === 'EN';

      const elevenLabsKey = await PlatformSetting.get('elevenlabs_api_key');
      const elevenLabsVoice = await PlatformSetting.get('elevenlabs_voice_id');
      const murfKey = await PlatformSetting.get('murf_api_key');
      const murfVoice = await PlatformSetting.get('murf_voice_id');

      const { generateTtsElevenLabs } = await import(
        '@/lib/content-pipeline/tts-elevenlabs'
      );
      const { generateTtsMurf } = await import(
        '@/lib/content-pipeline/tts-murf'
      );
      const {
        characterAlignmentToWords,
        murfDurationsToWords,
        generateSrt,
      } = await import('@/lib/content-pipeline/srt-generator');
      const { isB2Configured } = await import('@/lib/storage/b2');
      const { getUploadUrl, getPublicUrl } = await import(
        '@/lib/storage/presign'
      );

      if (!isB2Configured) {
        return errorResponse('B2 storage is not configured', 500);
      }

      let audioBuffer: Buffer;
      let srtContent: string;

      if (isEnglish && elevenLabsKey && elevenLabsVoice) {
        const result = await generateTtsElevenLabs(
          ttsText,
          elevenLabsVoice,
          elevenLabsKey
        );
        audioBuffer = result.audioBuffer;
        const words = characterAlignmentToWords(result.alignment);
        srtContent = generateSrt(words);
      } else if (murfKey && murfVoice) {
        const result = await generateTtsMurf(ttsText, murfVoice, murfKey);
        audioBuffer = result.audioBuffer;
        const words = murfDurationsToWords(result.wordDurations);
        srtContent = generateSrt(words);
      } else {
        return errorResponse(
          'No TTS provider configured for this language',
          500
        );
      }

      // Upload to B2
      const audioKey = `daily-content-audio/${content.post_date}/${translation_code}.mp3`;
      const srtKey = `daily-content-audio/${content.post_date}/${translation_code}.srt`;

      // Upload audio
      const uploadUrl = await getUploadUrl(audioKey, 'audio/mpeg');
      const audioRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/mpeg' },
        body: new Uint8Array(audioBuffer),
      });
      if (!audioRes.ok) {
        return errorResponse('Failed to upload audio to B2', 500);
      }
      const audioUrl = getPublicUrl(audioKey);

      // Upload SRT
      const srtUploadUrl = await getUploadUrl(srtKey, 'application/x-subrip');
      const srtRes = await fetch(srtUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-subrip' },
        body: new Uint8Array(Buffer.from(srtContent, 'utf-8')),
      });
      if (!srtRes.ok) {
        return errorResponse('Failed to upload SRT to B2', 500);
      }
      const srtUrl = getPublicUrl(srtKey);

      // Update translation record
      if (field === 'tts') {
        await translation.update({ audio_url: audioUrl, audio_srt_url: srtUrl });
      } else {
        // srt-only regeneration: re-upload SRT only
        await translation.update({ audio_srt_url: srtUrl });
      }

      await content.reload({
        include: [{ model: DailyContentTranslation, as: 'translations' }],
      });

      return successResponse({ content: content.toJSON() });
    }

    return errorResponse('Unknown field', 400);
  } catch (error) {
    return serverError(error, 'Failed to regenerate field');
  }
});
