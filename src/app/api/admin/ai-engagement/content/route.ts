/**
 * GET /api/admin/ai-engagement/content
 *
 * Fetches targetable content items with existing engagement counts.
 *
 * Query params:
 *   type=daily  → start, end, mode, language
 *   type=verse-category → category_id
 */

import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/auth/middleware';
import { sequelize } from '@/lib/db/models';
import { QueryTypes } from 'sequelize';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import type { ContentItem } from '@/lib/ai-engagement/types';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');

    if (type === 'daily') {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      const mode = url.searchParams.get('mode') || 'bible';
      const language = url.searchParams.get('language') || 'en';

      if (!start || !end) {
        return errorResponse('start and end query params required for daily type');
      }

      const rows = await sequelize.query<ContentItem>(
        `SELECT
           dc.id,
           dc.post_date AS label,
           dc.content_text,
           dc.verse_reference,
           dc.mode,
           (SELECT COUNT(*) FROM daily_comments c WHERE c.daily_content_id = dc.id) AS existing_comment_count,
           (SELECT COUNT(*) FROM daily_reactions r WHERE r.daily_content_id = dc.id) AS existing_reaction_count
         FROM daily_content dc
         WHERE dc.post_date >= :start
           AND dc.post_date <= :end
           AND dc.mode = :mode
           AND dc.language = :language
           AND dc.published = 1
         ORDER BY dc.post_date ASC`,
        {
          replacements: { start, end, mode, language },
          type: QueryTypes.SELECT,
        }
      );

      return successResponse({ items: rows });
    }

    if (type === 'verse-category') {
      const categoryId = url.searchParams.get('category_id');
      if (!categoryId) {
        return errorResponse('category_id query param required for verse-category type');
      }

      const rows = await sequelize.query<ContentItem>(
        `SELECT
           vcc.id,
           vcc.verse_reference AS label,
           vcc.content_text,
           vcc.verse_reference,
           vc.name AS category_name,
           (SELECT COUNT(*) FROM verse_category_comments c WHERE c.verse_category_content_id = vcc.id) AS existing_comment_count,
           (SELECT COUNT(*) FROM verse_category_reactions r WHERE r.verse_category_content_id = vcc.id) AS existing_reaction_count
         FROM verse_category_content vcc
         JOIN verse_categories vc ON vc.id = vcc.category_id
         WHERE vcc.category_id = :categoryId
         ORDER BY vcc.id ASC`,
        {
          replacements: { categoryId: Number(categoryId) },
          type: QueryTypes.SELECT,
        }
      );

      return successResponse({ items: rows });
    }

    return errorResponse('type must be "daily" or "verse-category"');
  } catch (err) {
    return serverError(err, 'Failed to fetch engagement content');
  }
});
