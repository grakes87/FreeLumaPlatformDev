import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { withAdmin } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { literal } from 'sequelize';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
});

const updateCategorySchema = z.object({
  id: z.number().int().positive('Valid category ID required'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

/**
 * GET /api/workshops/categories - List all active workshop categories with workshop counts
 */
export const GET = withAuth(
  async (_req: NextRequest, _context: AuthContext) => {
    try {
      const { WorkshopCategory } = await import('@/lib/db/models');

      const categories = await WorkshopCategory.findAll({
        where: { is_active: true },
        attributes: [
          'id',
          'name',
          'slug',
          'description',
          'sort_order',
          [
            literal(
              `(SELECT COUNT(*) FROM workshops WHERE workshops.category_id = \`WorkshopCategory\`.id AND workshops.status != 'cancelled')`
            ),
            'workshop_count',
          ],
        ],
        order: [['sort_order', 'ASC'], ['name', 'ASC']],
      });

      return successResponse({ categories });
    } catch (error) {
      return serverError(error, 'Failed to fetch workshop categories');
    }
  }
);

/**
 * POST /api/workshops/categories - Admin create a new workshop category
 */
export const POST = withAdmin(
  async (req: NextRequest, _context: AuthContext) => {
    try {
      const { WorkshopCategory } = await import('@/lib/db/models');

      const json = await req.json();
      const parsed = createCategorySchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { name, description } = parsed.data;
      const slug = slugify(name);

      // Check slug uniqueness
      const existing = await WorkshopCategory.findOne({ where: { slug } });
      if (existing) {
        return errorResponse('A category with this slug already exists', 409);
      }

      // Auto-assign sort_order to MAX + 1
      const maxOrder = await WorkshopCategory.max('sort_order') as number | null;
      const sort_order = (maxOrder ?? -1) + 1;

      const category = await WorkshopCategory.create({
        name,
        slug,
        description: description ?? null,
        sort_order,
      });

      return successResponse({ category }, 201);
    } catch (error) {
      return serverError(error, 'Failed to create workshop category');
    }
  }
);

/**
 * PUT /api/workshops/categories - Admin update an existing workshop category
 */
export const PUT = withAdmin(
  async (req: NextRequest, _context: AuthContext) => {
    try {
      const { WorkshopCategory } = await import('@/lib/db/models');

      const json = await req.json();
      const parsed = updateCategorySchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { id, name, description, is_active, sort_order } = parsed.data;

      const category = await WorkshopCategory.findByPk(id);
      if (!category) {
        return errorResponse('Category not found', 404);
      }

      // Build update object
      const updates: Record<string, unknown> = {};
      if (name !== undefined) {
        updates.name = name;
        updates.slug = slugify(name);

        // Check slug uniqueness (exclude current category)
        const existing = await WorkshopCategory.findOne({
          where: { slug: updates.slug as string },
        });
        if (existing && existing.id !== id) {
          return errorResponse('A category with this slug already exists', 409);
        }
      }
      if (description !== undefined) updates.description = description;
      if (is_active !== undefined) updates.is_active = is_active;
      if (sort_order !== undefined) updates.sort_order = sort_order;

      await category.update(updates);

      return successResponse({ category });
    } catch (error) {
      return serverError(error, 'Failed to update workshop category');
    }
  }
);

/**
 * DELETE /api/workshops/categories - Admin delete a workshop category
 */
export const DELETE = withAdmin(
  async (req: NextRequest, _context: AuthContext) => {
    try {
      const { WorkshopCategory, Workshop } = await import('@/lib/db/models');

      const { searchParams } = new URL(req.url);
      const id = parseInt(searchParams.get('id') || '', 10);

      if (!id || isNaN(id)) {
        return errorResponse('Category ID is required');
      }

      const category = await WorkshopCategory.findByPk(id);
      if (!category) {
        return errorResponse('Category not found', 404);
      }

      // Nullify category_id on workshops that reference this category
      await Workshop.update(
        { category_id: null },
        { where: { category_id: id } }
      );

      await category.destroy();

      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return serverError(error, 'Failed to delete workshop category');
    }
  }
);
