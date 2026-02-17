import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * Slugify a category name: lowercase, hyphenated, alphanumeric only.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * GET /api/admin/verse-categories - List ALL categories (including inactive)
 * Ordered by sort_order ASC. Includes verse_count and media_count via literal subquery.
 */
export const GET = withAdmin(async (_req: NextRequest, _context: AuthContext) => {
  try {
    const { VerseCategory, sequelize } = await import('@/lib/db/models');
    const { literal } = await import('sequelize');

    const categories = await VerseCategory.findAll({
      attributes: {
        include: [
          [
            literal('(SELECT COUNT(*) FROM verse_category_content WHERE verse_category_content.category_id = VerseCategory.id)'),
            'verse_count',
          ],
          [
            literal('(SELECT COUNT(*) FROM verse_category_media WHERE verse_category_media.category_id = VerseCategory.id)'),
            'media_count',
          ],
        ],
      },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });

    return successResponse({ categories });
  } catch (error) {
    return serverError(error, 'Failed to fetch verse categories');
  }
});

const postSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  thumbnail_url: z.string().max(500).optional(),
});

/**
 * POST /api/admin/verse-categories - Create a new category
 * Auto-generates slug from name. Sets sort_order = max existing + 1.
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { name, description, thumbnail_url } = parsed.data;
    const slug = slugify(name);

    if (!slug) {
      return errorResponse('Name must contain at least one alphanumeric character');
    }

    const { VerseCategory, sequelize } = await import('@/lib/db/models');

    // Check for duplicate slug
    const existingSlug = await VerseCategory.findOne({ where: { slug } });
    if (existingSlug) {
      return errorResponse('A category with a similar name already exists', 409);
    }

    // Get max sort_order
    const [rows] = await sequelize.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM verse_categories'
    );
    const maxResult = (rows as Array<{ max_order: number }>)[0];
    const nextOrder = (maxResult?.max_order ?? 0) + 1;

    const category = await VerseCategory.create({
      name,
      slug,
      description: description ?? null,
      thumbnail_url: thumbnail_url ?? null,
      sort_order: nextOrder,
    });

    return successResponse({ category }, 201);
  } catch (error) {
    if ((error as { name?: string }).name === 'SequelizeUniqueConstraintError') {
      return errorResponse('A category with this slug already exists', 409);
    }
    return serverError(error, 'Failed to create verse category');
  }
});

const putSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  thumbnail_url: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

/**
 * PUT /api/admin/verse-categories - Update a category
 * If name changes, slug is regenerated. Supports reorder via sort_order.
 */
export const PUT = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = putSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { id, name, ...updateData } = parsed.data;

    const { VerseCategory } = await import('@/lib/db/models');

    const category = await VerseCategory.findByPk(id);
    if (!category) {
      return errorResponse('Category not found', 404);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { ...updateData };

    if (name !== undefined) {
      const newSlug = slugify(name);
      if (!newSlug) {
        return errorResponse('Name must contain at least one alphanumeric character');
      }

      // Check for duplicate slug (excluding self)
      const existingSlug = await VerseCategory.findOne({
        where: { slug: newSlug },
      });
      if (existingSlug && existingSlug.id !== id) {
        return errorResponse('A category with a similar name already exists', 409);
      }

      updates.name = name;
      updates.slug = newSlug;
    }

    await category.update(updates);

    return successResponse({ category });
  } catch (error) {
    if ((error as { name?: string }).name === 'SequelizeUniqueConstraintError') {
      return errorResponse('A category with this slug already exists', 409);
    }
    return serverError(error, 'Failed to update verse category');
  }
});
