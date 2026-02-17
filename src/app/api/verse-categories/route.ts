import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { VerseCategory } from '@/lib/db/models';
import { successResponse, serverError } from '@/lib/utils/api';
import { literal } from 'sequelize';

export const GET = withAuth(
  async (_req: NextRequest, _context: AuthContext) => {
    try {
      const categories = await VerseCategory.findAll({
        where: { active: true },
        attributes: [
          'id',
          'name',
          'slug',
          'description',
          'thumbnail_url',
          'sort_order',
          [
            literal(
              '(SELECT COUNT(*) FROM verse_category_content WHERE verse_category_content.category_id = `VerseCategory`.`id`)'
            ),
            'verse_count',
          ],
        ],
        order: [['sort_order', 'ASC']],
        raw: true,
      });

      // Calculate total verse count across all categories
      const totalVerseCount = (categories as unknown as { verse_count: string }[]).reduce(
        (sum, cat) => sum + parseInt(String(cat.verse_count || '0'), 10),
        0
      );

      // Prepend virtual "All" entry
      const result = [
        {
          id: 'all' as string | number,
          name: 'All',
          slug: 'all',
          description: null,
          thumbnail_url: null,
          sort_order: -1,
          verse_count: totalVerseCount,
        },
        ...(categories as unknown as Record<string, unknown>[]).map((c) => ({
          ...c,
          verse_count: parseInt(String(c.verse_count || '0'), 10),
        })),
      ];

      return successResponse(result);
    } catch (error) {
      return serverError(error, 'Failed to fetch verse categories');
    }
  }
);
