import { NextRequest } from 'next/server';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/verse-by-category/prefetch-bg
 * Lightweight endpoint that returns only a random background media URL.
 * Used by the client to preload the next image in the browser cache.
 */
export const GET = withOptionalAuth(
  async (req: NextRequest, _context: OptionalAuthContext) => {
    try {
      const { VerseCategoryMedia, sequelize } = await import('@/lib/db/models');
      const { Op } = await import('sequelize');

      const { searchParams } = new URL(req.url);
      const categoryIdParam = searchParams.get('category_id');

      const where: Record<string, unknown> = {};

      if (categoryIdParam && categoryIdParam !== 'all') {
        const categoryId = parseInt(categoryIdParam, 10);
        if (!isNaN(categoryId)) {
          where[Op.or as unknown as string] = [
            { category_id: categoryId },
            { category_id: null },
          ];
        }
      }

      const media = await VerseCategoryMedia.findOne({
        where,
        attributes: ['media_url'],
        order: sequelize.random(),
      });

      return successResponse({
        background_url: media?.media_url ?? null,
      });
    } catch (error) {
      return serverError(error, 'Failed to prefetch background');
    }
  }
);
