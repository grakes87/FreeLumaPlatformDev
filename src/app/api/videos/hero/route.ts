import { NextRequest, NextResponse } from 'next/server';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';
import { Op, literal } from 'sequelize';

/**
 * GET /api/videos/hero — Get the featured hero video for the banner
 */
export const GET = withOptionalAuth(
  async (_req: NextRequest, _context: OptionalAuthContext) => {
    try {
      const { Video, VideoCategory } = await import('@/lib/db/models');

      const hero = await Video.findOne({
        where: {
          is_hero: true,
          published: true,
          [Op.or]: [
            { published_at: null },
            { published_at: { [Op.lte]: literal('NOW()') } },
          ],
        },
        include: [
          {
            model: VideoCategory,
            as: 'category',
            attributes: ['id', 'name', 'slug'],
          },
        ],
      });

      if (!hero) {
        return new NextResponse(null, { status: 204 });
      }

      return successResponse({ video: hero });
    } catch (error) {
      return serverError(error, 'Failed to fetch hero video');
    }
  }
);
