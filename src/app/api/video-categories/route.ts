import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
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
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
});

/**
 * GET /api/video-categories — List all active video categories with video counts
 */
export const GET = withOptionalAuth(
  async (_req: NextRequest, _context: OptionalAuthContext) => {
    try {
      const { VideoCategory } = await import('@/lib/db/models');

      const categories = await VideoCategory.findAll({
        where: { is_active: true },
        attributes: [
          'id',
          'name',
          'slug',
          'description',
          'sort_order',
          [
            literal(
              `(SELECT COUNT(*) FROM videos WHERE videos.category_id = \`VideoCategory\`.id AND videos.published = 1)`
            ),
            'video_count',
          ],
        ],
        order: [['sort_order', 'ASC'], ['name', 'ASC']],
      });

      return successResponse({ categories });
    } catch (error) {
      return serverError(error, 'Failed to fetch video categories');
    }
  }
);

/**
 * POST /api/video-categories — Admin create a new video category
 */
export const POST = withAdmin(
  async (req: NextRequest, _context: AuthContext) => {
    try {
      const { VideoCategory } = await import('@/lib/db/models');

      const json = await req.json();
      const parsed = createCategorySchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { name, slug: rawSlug, description, sort_order } = parsed.data;
      const slug = rawSlug || slugify(name);

      // Check slug uniqueness
      const existing = await VideoCategory.findOne({ where: { slug } });
      if (existing) {
        return errorResponse('A category with this slug already exists', 409);
      }

      const category = await VideoCategory.create({
        name,
        slug,
        description: description ?? null,
        sort_order: sort_order ?? 0,
      });

      return successResponse({ category }, 201);
    } catch (error) {
      return serverError(error, 'Failed to create video category');
    }
  }
);
