import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

export const maxDuration = 300; // 5 minutes — TTS calls can be slow

const regenerateSchema = z.object({
  daily_content_id: z.number().int().positive(),
  field: z.enum([
    'camera_script',
    'devotional_reflection',
    'meditation_script',
    'meditation_audio',
    'background_prompt',
    'chapter_text',
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
 *   field: 'camera_script' | 'devotional_reflection' | 'meditation_script' | 'meditation_audio' | 'background_prompt' | 'tts' | 'srt'
 *   translation_code?: string (required for tts/srt)
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContent, DailyContentTranslation, BibleTranslation, PlatformSetting, ContentGenerationLog } =
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

    // Validate translation_code is required for translation-level fields
    if ((field === 'tts' || field === 'srt' || field === 'chapter_text') && !translation_code) {
      return errorResponse('translation_code is required for tts/srt/chapter_text regeneration', 400);
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

    // Create generation log entry
    const startTime = Date.now();
    const logEntry = await ContentGenerationLog.create({
      daily_content_id,
      field,
      translation_code: translation_code || null,
      status: 'started',
    });

    try {
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

      await logEntry.update({ status: 'success', duration_ms: Date.now() - startTime });
      return successResponse({ content: content.toJSON(), log_id: logEntry.id });
    }

    // Handle chapter_text regeneration
    if (field === 'chapter_text') {
      // Positivity mode: regenerate the motivational quote (no bible verse)
      if (content.mode === 'positivity') {
        const { generatePositivityQuote } = await import('@/lib/content-pipeline/text-generation');
        const { Op } = await import('sequelize');

        // Fetch existing quotes for deduplication
        const existingRows = await DailyContent.findAll({
          attributes: ['content_text'],
          where: {
            mode: 'positivity',
            content_text: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            id: { [Op.ne]: daily_content_id }, // exclude current row
          },
          order: [['post_date', 'DESC']],
          raw: true,
        });
        const existingQuotes = existingRows
          .map((r: { content_text: string }) => r.content_text)
          .filter(Boolean);

        const newQuote = await generatePositivityQuote(existingQuotes);

        // Update the main content row
        await content.update({
          content_text: newQuote,
          title: newQuote.substring(0, 100),
        });

        // Update or create the EN translation row
        let translation = await DailyContentTranslation.findOne({
          where: { daily_content_id, translation_code: translation_code! },
        });

        if (translation) {
          await translation.update({
            translated_text: newQuote,
            chapter_text: newQuote,
            source: 'database',
          });
        } else {
          await DailyContentTranslation.create({
            daily_content_id,
            translation_code: translation_code!,
            translated_text: newQuote,
            chapter_text: newQuote,
            source: 'database',
          });
        }

        await content.reload({
          include: [{ model: DailyContentTranslation, as: 'translations' }],
        });

        await logEntry.update({ status: 'success', duration_ms: Date.now() - startTime });
        return successResponse({ content: content.toJSON(), log_id: logEntry.id });
      }

      // Bible mode: re-fetch verse translation from Bible API
      if (!content.verse_reference) {
        await logEntry.update({ status: 'failed', error_message: 'No verse reference set', duration_ms: Date.now() - startTime });
        return errorResponse('No verse reference set for this content', 400);
      }

      const { fetchPassage } = await import('@/lib/bible-api/index');

      const verseText = await fetchPassage(
        content.verse_reference,
        translation_code!,
        'verse'
      );

      if (!verseText) {
        return errorResponse(
          `Could not fetch verse text for ${translation_code} — API returned nothing`,
          502
        );
      }

      // Find or create translation row
      let translation = await DailyContentTranslation.findOne({
        where: { daily_content_id, translation_code: translation_code! },
      });

      if (translation) {
        await translation.update({
          translated_text: verseText,
          verse_reference: content.verse_reference,
          source: 'api',
        });
      } else {
        await DailyContentTranslation.create({
          daily_content_id,
          translation_code: translation_code!,
          translated_text: verseText,
          verse_reference: content.verse_reference,
          source: 'api',
        });
      }

      // Also fetch chapter_text (full chapter) if not present
      const chapterText = await fetchPassage(
        content.verse_reference,
        translation_code!,
        'chapter'
      );
      if (chapterText) {
        translation = await DailyContentTranslation.findOne({
          where: { daily_content_id, translation_code: translation_code! },
        });
        if (translation) {
          await translation.update({ chapter_text: chapterText });
        }
      }

      await content.reload({
        include: [{ model: DailyContentTranslation, as: 'translations' }],
      });

      await logEntry.update({ status: 'success', duration_ms: Date.now() - startTime });
      return successResponse({ content: content.toJSON(), log_id: logEntry.id });
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

      const ttsText = translation.chapter_text;
      if (!ttsText) {
        await logEntry.update({ status: 'failed', error_message: 'No chapter text available for TTS generation', duration_ms: Date.now() - startTime });
        return errorResponse(
          'No chapter text available for TTS generation. Fetch the translation text first.',
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
      const murfKey = await PlatformSetting.get('murf_api_key');

      // Build ElevenLabs English voice pool
      const englishVoices: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const vid = await PlatformSetting.get(`elevenlabs_voice_${i}`);
        if (vid) englishVoices.push(vid);
      }

      // Build Murf Spanish voice pool
      const spanishVoices: { voiceId: string; style: string }[] = [];
      for (let i = 1; i <= 3; i++) {
        const vid = await PlatformSetting.get(`murf_voice_es_${i}`);
        const sty = await PlatformSetting.get(`murf_style_es_${i}`);
        if (vid) spanishVoices.push({ voiceId: vid, style: sty || '' });
      }

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
        await logEntry.update({ status: 'failed', error_message: 'B2 storage is not configured', duration_ms: Date.now() - startTime });
        return errorResponse('B2 storage is not configured', 500);
      }

      let audioBuffer: Buffer;
      let srtContent: string;

      if (isEnglish && elevenLabsKey && englishVoices.length > 0) {
        // ElevenLabs for English — random voice from pool
        const voice = englishVoices[Math.floor(Math.random() * englishVoices.length)];
        const elResult = await generateTtsElevenLabs(ttsText, voice, elevenLabsKey);
        audioBuffer = elResult.audioBuffer;
        const words = characterAlignmentToWords(elResult.alignment);
        srtContent = generateSrt(words);
      } else if (!isEnglish && murfKey && spanishVoices.length > 0) {
        // Murf Spanish — random voice from pool
        const voice = spanishVoices[Math.floor(Math.random() * spanishVoices.length)];
        const result = await generateTtsMurf(ttsText, voice.voiceId, murfKey, voice.style || undefined);
        audioBuffer = result.audioBuffer;
        const words = murfDurationsToWords(result.wordDurations);
        srtContent = generateSrt(words);
      } else {
        await logEntry.update({ status: 'failed', error_message: 'No TTS provider configured for this language', duration_ms: Date.now() - startTime });
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
        await logEntry.update({ status: 'failed', error_message: 'Failed to upload audio to B2', duration_ms: Date.now() - startTime });
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
        await logEntry.update({ status: 'failed', error_message: 'Failed to upload SRT to B2', duration_ms: Date.now() - startTime });
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

      await logEntry.update({ status: 'success', duration_ms: Date.now() - startTime });
      return successResponse({ content: content.toJSON(), log_id: logEntry.id });
    }

    // Handle meditation audio TTS generation
    if (field === 'meditation_audio') {
      const meditationText = content.meditation_script;
      if (!meditationText) {
        await logEntry.update({ status: 'failed', error_message: 'No meditation script available for TTS generation', duration_ms: Date.now() - startTime });
        return errorResponse(
          'No meditation script available for TTS generation. Generate the meditation script first.',
          400
        );
      }

      const elevenLabsKey = await PlatformSetting.get('elevenlabs_api_key');

      // Build ElevenLabs English voice pool
      const medVoices: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const vid = await PlatformSetting.get(`elevenlabs_voice_${i}`);
        if (vid) medVoices.push(vid);
      }

      const { generateTtsElevenLabs } = await import(
        '@/lib/content-pipeline/tts-elevenlabs'
      );
      const { isB2Configured } = await import('@/lib/storage/b2');
      const { getUploadUrl, getPublicUrl } = await import(
        '@/lib/storage/presign'
      );

      if (!isB2Configured) {
        await logEntry.update({ status: 'failed', error_message: 'B2 storage is not configured', duration_ms: Date.now() - startTime });
        return errorResponse('B2 storage is not configured', 500);
      }

      if (!elevenLabsKey || medVoices.length === 0) {
        await logEntry.update({ status: 'failed', error_message: 'No ElevenLabs TTS provider configured', duration_ms: Date.now() - startTime });
        return errorResponse('No ElevenLabs TTS provider configured for meditation audio', 500);
      }

      // Use a random voice from the pool
      const voice = medVoices[Math.floor(Math.random() * medVoices.length)];
      const elResult = await generateTtsElevenLabs(meditationText, voice, elevenLabsKey);

      // Mix with background music
      const { mixWithBackgroundMusic } = await import(
        '@/lib/content-pipeline/audio-mixer'
      );
      const mixedAudio = await mixWithBackgroundMusic(elResult.audioBuffer);

      // Upload mixed audio to B2
      const audioKey = `daily-content-audio/${content.post_date}/meditation.mp3`;
      const uploadUrl = await getUploadUrl(audioKey, 'audio/mpeg');
      const audioRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/mpeg' },
        body: new Uint8Array(mixedAudio),
      });
      if (!audioRes.ok) {
        await logEntry.update({ status: 'failed', error_message: 'Failed to upload meditation audio to B2', duration_ms: Date.now() - startTime });
        return errorResponse('Failed to upload meditation audio to B2', 500);
      }
      const audioUrl = getPublicUrl(audioKey);

      // Update DailyContent record with meditation audio URL
      await content.update({ meditation_audio_url: audioUrl });
      await content.reload({
        include: [{ model: DailyContentTranslation, as: 'translations' }],
      });

      await logEntry.update({ status: 'success', duration_ms: Date.now() - startTime });
      return successResponse({ content: content.toJSON(), log_id: logEntry.id });
    }

    await logEntry.update({ status: 'failed', error_message: 'Unknown field', duration_ms: Date.now() - startTime });
    return errorResponse('Unknown field', 400);
    } catch (genError) {
      // Update log with failure
      const errMsg = genError instanceof Error ? genError.message : String(genError);
      await logEntry.update({ status: 'failed', error_message: errMsg, duration_ms: Date.now() - startTime });
      throw genError; // re-throw for outer catch
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return errorResponse(msg || 'Failed to regenerate field', 500);
  }
});
