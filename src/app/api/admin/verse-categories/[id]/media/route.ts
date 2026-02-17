import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/verse-categories/[id]/media
 * List all media for category (where category_id = id OR category_id IS NULL for shared).
 * Paginated (limit/offset).
 */
export const GET = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const categoryId = parseInt(params.id, 10);
    if (isNaN(categoryId)) {
      return errorResponse('Invalid category ID');
    }

    const { VerseCategoryMedia, VerseCategory } = await import('@/lib/db/models');

    // Verify category exists
    const category = await VerseCategory.findByPk(categoryId);
    if (!category) {
      return errorResponse('Category not found', 404);
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const { count, rows: media } = await VerseCategoryMedia.findAndCountAll({
      where: {
        [Op.or]: [
          { category_id: categoryId },
          { category_id: null },
        ],
      },
      include: [
        {
          model: VerseCategory,
          as: 'category',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      order: [['id', 'DESC']],
      limit,
      offset,
    });

    return successResponse({
      media,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch media');
  }
});

const postSchema = z.object({
  media_url: z.string().url().max(500),
  media_key: z.string().min(1).max(255),
  shared: z.boolean().optional().default(false),
});

/**
 * POST /api/admin/verse-categories/[id]/media
 * Add media record. If shared=true, set category_id=NULL. Otherwise category_id=params.id.
 * Note: Actual file upload to B2 uses existing presigned URL flow.
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const categoryId = parseInt(params.id, 10);
    if (isNaN(categoryId)) {
      return errorResponse('Invalid category ID');
    }

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { media_url, media_key, shared } = parsed.data;

    const { VerseCategoryMedia, VerseCategory } = await import('@/lib/db/models');

    // Verify category exists
    const category = await VerseCategory.findByPk(categoryId);
    if (!category) {
      return errorResponse('Category not found', 404);
    }

    const record = await VerseCategoryMedia.create({
      category_id: shared ? null : categoryId,
      media_url,
      media_key,
    });

    return successResponse({ media: record }, 201);
  } catch (error) {
    return serverError(error, 'Failed to add media');
  }
});

/**
 * DELETE /api/admin/verse-categories/[id]/media
 * Remove media record by media_id query param.
 * Does NOT delete from B2 -- admin is responsible for storage cleanup.
 */
export const DELETE = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const categoryId = parseInt(params.id, 10);
    if (isNaN(categoryId)) {
      return errorResponse('Invalid category ID');
    }

    const url = new URL(req.url);
    const mediaId = parseInt(url.searchParams.get('media_id') || '', 10);
    if (isNaN(mediaId)) {
      return errorResponse('media_id query parameter is required');
    }

    const { VerseCategoryMedia } = await import('@/lib/db/models');

    const media = await VerseCategoryMedia.findByPk(mediaId);
    if (!media) {
      return errorResponse('Media not found', 404);
    }

    await media.destroy();

    return successResponse({ success: true, deleted_media_id: mediaId });
  } catch (error) {
    return serverError(error, 'Failed to delete media');
  }
});
