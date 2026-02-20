import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const postSchema = z.object({
  verse_ids: z.array(z.number().int().positive()).min(1).max(500),
});

/**
 * POST /api/admin/verse-categories/[id]/bulk-delete
 * Bulk delete verses by ID array. CASCADE handles translations, reactions, comments.
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    // Extract category ID from URL
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const idIdx = segments.indexOf('verse-categories') + 1;
    const categoryId = parseInt(segments[idIdx], 10);
    if (isNaN(categoryId) || categoryId <= 0) {
      return errorResponse('Invalid category ID');
    }

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { verse_ids } = parsed.data;

    const { VerseCategoryContent } = await import('@/lib/db/models');

    // Delete only verses that belong to this category
    const deletedCount = await VerseCategoryContent.destroy({
      where: {
        id: { [Op.in]: verse_ids },
        category_id: categoryId,
      },
    });

    return successResponse({ deleted_count: deletedCount });
  } catch (error) {
    return serverError(error, 'Failed to bulk delete verses');
  }
});
