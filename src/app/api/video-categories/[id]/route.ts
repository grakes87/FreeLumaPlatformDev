import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

/**
 * PUT /api/video-categories/[id] — Admin update a video category
 */
export const PUT = withAdmin(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { VideoCategory } = await import('@/lib/db/models');

      const params = await context.params;
      const categoryId = parseInt(params.id, 10);
      if (isNaN(categoryId)) {
        return errorResponse('Invalid category ID');
      }

      const json = await req.json();
      const parsed = updateCategorySchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const category = await VideoCategory.findByPk(categoryId);
      if (!category) {
        return errorResponse('Category not found', 404);
      }

      // If slug changed, check uniqueness
      if (parsed.data.slug && parsed.data.slug !== category.slug) {
        const existing = await VideoCategory.findOne({
          where: { slug: parsed.data.slug },
        });
        if (existing) {
          return errorResponse('A category with this slug already exists', 409);
        }
      }

      await category.update(parsed.data);

      return successResponse({ category });
    } catch (error) {
      return serverError(error, 'Failed to update video category');
    }
  }
);

/**
 * DELETE /api/video-categories/[id] — Admin delete a video category
 */
export const DELETE = withAdmin(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const { VideoCategory, Video } = await import('@/lib/db/models');

      const params = await context.params;
      const categoryId = parseInt(params.id, 10);
      if (isNaN(categoryId)) {
        return errorResponse('Invalid category ID');
      }

      const category = await VideoCategory.findByPk(categoryId);
      if (!category) {
        return errorResponse('Category not found', 404);
      }

      // Check if any videos reference this category
      const videoCount = await Video.count({ where: { category_id: categoryId } });
      if (videoCount > 0) {
        return errorResponse(
          `Cannot delete category: ${videoCount} video(s) still assigned. Reassign them first.`,
          400
        );
      }

      await category.destroy();

      return successResponse({ message: 'Category deleted successfully' });
    } catch (error) {
      return serverError(error, 'Failed to delete video category');
    }
  }
);
