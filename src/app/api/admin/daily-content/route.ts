import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdmin } from '@/lib/auth/middleware';
import { DailyContent, DailyContentTranslation } from '@/lib/db/models';
import { sequelize } from '@/lib/db/models';
import { Op } from 'sequelize';

// POST: Schedule daily content
const postSchema = z.object({
  post_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'post_date must be YYYY-MM-DD format'),
  mode: z.enum(['bible', 'positivity']),
  title: z.string().min(1).max(255),
  content_text: z.string().min(1),
  verse_reference: z.string().max(255).optional(),
  chapter_reference: z.string().max(255).optional(),
  video_background_url: z.string().max(500),
  audio_url: z.string().max(500).optional(),
  audio_srt_url: z.string().max(500).optional(),
  lumashort_video_url: z.string().max(500).optional(),
  language: z.enum(['en', 'es']).optional().default('en'),
  translations: z.array(z.object({
    code: z.string().min(1).max(10),
    text: z.string().min(1),
    audio_url: z.string().max(500).nullable().optional(),
    audio_srt_url: z.string().max(500).nullable().optional(),
  })).optional(),
});

export const POST = withAdmin(async (req: NextRequest) => {
  const transaction = await sequelize.transaction();

  try {
    const body = await req.json();
    const result = postSchema.safeParse(body);

    if (!result.success) {
      await transaction.rollback();
      const firstError = result.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { translations, ...contentData } = result.data;

    const dailyContent = await DailyContent.create(
      {
        post_date: contentData.post_date,
        mode: contentData.mode,
        title: contentData.title,
        content_text: contentData.content_text,
        verse_reference: contentData.verse_reference ?? null,
        chapter_reference: contentData.chapter_reference ?? null,
        video_background_url: contentData.video_background_url,
        audio_url: contentData.audio_url ?? null,
        audio_srt_url: contentData.audio_srt_url ?? null,
        lumashort_video_url: contentData.lumashort_video_url ?? null,
        language: contentData.language,
      },
      { transaction }
    );

    if (translations && translations.length > 0) {
      const translationRecords = translations.map((t) => ({
        daily_content_id: dailyContent.id,
        translation_code: t.code,
        translated_text: t.text,
        audio_url: t.audio_url ?? null,
        audio_srt_url: t.audio_srt_url ?? null,
      }));
      await DailyContentTranslation.bulkCreate(translationRecords, { transaction });
    }

    await transaction.commit();

    // Fetch with translations for response
    const created = await DailyContent.findByPk(dailyContent.id, {
      include: [{ model: DailyContentTranslation, as: 'translations' }],
    });

    return NextResponse.json(
      { content: created },
      { status: 201 }
    );
  } catch (error) {
    await transaction.rollback();

    // Handle unique constraint violation
    if ((error as { name?: string }).name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json(
        { error: 'Daily content for this date, mode, and language already exists' },
        { status: 409 }
      );
    }

    console.error('Admin daily content POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PUT: Update daily content
const putSchema = z.object({
  id: z.number().int().positive(),
  post_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'post_date must be YYYY-MM-DD format').optional(),
  mode: z.enum(['bible', 'positivity']).optional(),
  title: z.string().min(1).max(255).optional(),
  content_text: z.string().min(1).optional(),
  verse_reference: z.string().max(255).nullable().optional(),
  chapter_reference: z.string().max(255).nullable().optional(),
  video_background_url: z.string().max(500).optional(),
  audio_url: z.string().max(500).nullable().optional(),
  audio_srt_url: z.string().max(500).nullable().optional(),
  lumashort_video_url: z.string().max(500).nullable().optional(),
  language: z.enum(['en', 'es']).optional(),
  published: z.boolean().optional(),
  translations: z.array(z.object({
    code: z.string().min(1).max(10),
    text: z.string().min(1),
    audio_url: z.string().max(500).nullable().optional(),
    audio_srt_url: z.string().max(500).nullable().optional(),
  })).optional(),
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const transaction = await sequelize.transaction();

  try {
    const body = await req.json();
    const result = putSchema.safeParse(body);

    if (!result.success) {
      await transaction.rollback();
      const firstError = result.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { id, translations, ...updateData } = result.data;

    const existing = await DailyContent.findByPk(id, { transaction });
    if (!existing) {
      await transaction.rollback();
      return NextResponse.json(
        { error: 'Daily content not found' },
        { status: 404 }
      );
    }

    await existing.update(updateData, { transaction });

    // If translations provided, replace them
    if (translations) {
      await DailyContentTranslation.destroy({
        where: { daily_content_id: id },
        transaction,
      });

      if (translations.length > 0) {
        const translationRecords = translations.map((t) => ({
          daily_content_id: id,
          translation_code: t.code,
          translated_text: t.text,
          audio_url: t.audio_url ?? null,
          audio_srt_url: t.audio_srt_url ?? null,
        }));
        await DailyContentTranslation.bulkCreate(translationRecords, { transaction });
      }
    }

    await transaction.commit();

    const updated = await DailyContent.findByPk(id, {
      include: [{ model: DailyContentTranslation, as: 'translations' }],
    });

    return NextResponse.json({ content: updated });
  } catch (error) {
    await transaction.rollback();

    if ((error as { name?: string }).name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json(
        { error: 'Daily content for this date, mode, and language already exists' },
        { status: 409 }
      );
    }

    console.error('Admin daily content PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// GET: List daily content
const getQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  mode: z.enum(['bible', 'positivity']).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const result = getQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      mode: searchParams.get('mode') ?? undefined,
      start_date: searchParams.get('start_date') ?? undefined,
      end_date: searchParams.get('end_date') ?? undefined,
    });

    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { page, limit, mode, start_date, end_date } = result.data;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (mode) where.mode = mode;
    if (start_date && end_date) {
      where.post_date = { [Op.between]: [start_date, end_date] };
    } else if (start_date) {
      where.post_date = { [Op.gte]: start_date };
    } else if (end_date) {
      where.post_date = { [Op.lte]: end_date };
    }

    const { rows: content, count: total } = await DailyContent.findAndCountAll({
      where,
      include: [{ model: DailyContentTranslation, as: 'translations' }],
      order: [['post_date', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return NextResponse.json({
      content,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Admin daily content GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
