import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format'),
  mode: z.enum(['bible', 'positivity']),
  language: z.string().min(2).max(5).default('en'),
});

/**
 * GET /api/admin/content-production
 *
 * Returns a month overview with per-day content status and aggregate stats.
 *
 * Query params:
 *   month: YYYY-MM (required)
 *   mode: 'bible' | 'positivity' (required)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContent, DailyContentTranslation, LumaShortCreator, User, BibleTranslation } =
      await import('@/lib/db/models');
    const { Op } = await import('sequelize');

    const { searchParams } = new URL(req.url);
    const parsed = monthQuerySchema.safeParse({
      month: searchParams.get('month'),
      mode: searchParams.get('mode'),
      language: searchParams.get('language') || 'en',
    });

    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || 'Missing or invalid month/mode query params',
        400
      );
    }

    const { month, mode, language } = parsed.data;

    // Parse month to get date range
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    // Query all DailyContent for this month/mode with creator and translations
    const rows = await DailyContent.findAll({
      where: {
        post_date: { [Op.between]: [startDate, endDate] },
        mode,
        language,
      },
      include: [
        {
          model: LumaShortCreator,
          as: 'creator',
          attributes: ['id', 'name', 'user_id', 'is_ai', 'heygen_avatar_id'],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'avatar_url', 'avatar_color'],
            },
          ],
        },
        {
          model: DailyContentTranslation,
          as: 'translations',
          attributes: [
            'id',
            'translation_code',
            'translated_text',
            'audio_url',
            'audio_srt_url',
            'chapter_text',
          ],
        },
      ],
      order: [['post_date', 'ASC']],
    });

    // Compute stats
    let generated = 0;
    let assigned = 0;
    let submitted = 0;
    let approved = 0;
    let rejected = 0;

    for (const row of rows) {
      if (row.status !== 'empty') generated++;
      if (row.creator_id !== null) assigned++;
      if (row.status === 'submitted') submitted++;
      if (row.status === 'approved') approved++;
      if (row.status === 'rejected') rejected++;
    }

    const stats = {
      total_days: daysInMonth,
      generated,
      assigned,
      submitted,
      approved,
      rejected,
      missing: daysInMonth - generated,
    };

    // Build per-day response
    const days = rows.map((row) => {
      const json = row.toJSON() as unknown as Record<string, unknown>;
      const translations = (json.translations as Array<Record<string, unknown>>) || [];

      return {
        id: row.id,
        post_date: row.post_date,
        status: row.status,
        creator: json.creator || null,
        title: row.title,
        verse_reference: row.verse_reference,
        has_camera_script: Boolean(row.camera_script),
        has_devotional: Boolean(row.devotional_reflection),
        has_meditation: Boolean(row.meditation_script),
        meditation_script: row.meditation_script || null,
        has_meditation_audio: Boolean(row.meditation_audio_url),
        meditation_audio_url: row.meditation_audio_url || null,
        has_background_prompt: Boolean(row.background_prompt),
        has_background_video: Boolean(row.video_background_url),
        has_lumashort_video: Boolean(row.lumashort_video_url),
        lumashort_video_url: row.lumashort_video_url || null,
        background_prompt: row.background_prompt || null,
        content_text: row.content_text || null,
        translations: translations.map((t) => ({
          translation_code: t.translation_code,
          has_translated_text: Boolean(t.translated_text),
          has_audio: Boolean(t.audio_url),
          has_srt: Boolean(t.audio_srt_url),
          has_chapter_text: Boolean(t.chapter_text),
          audio_url: (t.audio_url as string) || null,
        })),
      };
    });

    // Fetch all active creators for assignment UI
    const creators = await LumaShortCreator.findAll({
      where: { active: true },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'avatar_url', 'avatar_color'],
        },
      ],
      order: [['name', 'ASC']],
    });

    const creatorsData = creators.map((c) => {
      const json = c.toJSON() as unknown as Record<string, unknown>;
      return {
        id: c.id,
        name: c.name,
        user_id: c.user_id,
        user: json.user || null,
        monthly_capacity: c.monthly_capacity,
        can_bible: c.can_bible,
        can_positivity: c.can_positivity,
        is_ai: c.is_ai,
        active: c.active,
      };
    });

    // Fetch expected bible translations for this language (bible mode only)
    let expectedTranslations: string[] = [];
    if (mode === 'bible') {
      const bts = await BibleTranslation.findAll({
        where: { language },
        attributes: ['code'],
        order: [['code', 'ASC']],
      });
      expectedTranslations = bts.map((bt) => bt.code);
    }

    return successResponse({ stats, days, creators: creatorsData, expectedTranslations });
  } catch (error) {
    return serverError(error, 'Failed to fetch month overview');
  }
});
