import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Post,
  PrayerRequest,
  PrayerSupport,
  User,
} from '@/lib/db/models';
import { encodeCursor, decodeCursor } from '@/lib/utils/cursor';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/prayer-requests/[id]/supporters - List who prayed for this request
 *
 * Only the prayer request author can see this list.
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;
      const params = await context.params;
      const prayerRequestId = parseInt(params.id);

      if (isNaN(prayerRequestId)) {
        return errorResponse('Invalid prayer request ID');
      }

      // Find the prayer request and verify ownership
      const prayerRequest = await PrayerRequest.findByPk(prayerRequestId, {
        include: [
          {
            model: Post,
            as: 'post',
            where: { deleted_at: null },
            attributes: ['id', 'user_id'],
          },
        ],
      });

      if (!prayerRequest) {
        return errorResponse('Prayer request not found', 404);
      }

      const post = (prayerRequest as unknown as Record<string, unknown>).post as Post;
      if (!post) {
        return errorResponse('Prayer request not found', 404);
      }

      // Only the author can see supporters
      if (post.user_id !== userId) {
        return errorResponse('Only the prayer request author can view supporters', 403);
      }

      const { searchParams } = new URL(req.url);
      const cursor = searchParams.get('cursor');
      const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 50);

      // Build where clause
      const where: Record<string, unknown> = {
        prayer_request_id: prayerRequestId,
      };

      if (cursor) {
        const decoded = decodeCursor(cursor);
        if (decoded) {
          where[Op.or as unknown as string] = [
            {
              created_at: { [Op.lt]: decoded.created_at },
            },
            {
              created_at: decoded.created_at,
              id: { [Op.lt]: decoded.id },
            },
          ];
        }
      }

      const supports = await PrayerSupport.findAll({
        where,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'],
          },
        ],
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit: limit + 1,
      });

      const hasMore = supports.length > limit;
      const results = hasMore ? supports.slice(0, limit) : supports;

      // Get total count
      const total = await PrayerSupport.count({
        where: { prayer_request_id: prayerRequestId },
      });

      const supporters = results.map((s) => {
        const plain = s.toJSON() as unknown as Record<string, unknown>;
        const user = plain.user as Record<string, unknown> | null;
        return {
          id: user?.id ?? plain.id,
          username: user?.username ?? 'unknown',
          display_name: user?.display_name ?? 'Unknown',
          avatar_url: (user?.avatar_url as string) ?? null,
          avatar_color: (user?.avatar_color as string) ?? '#62BEBA',
          created_at: plain.created_at,
        };
      });

      const nextCursor = hasMore && results.length > 0
        ? encodeCursor(results[results.length - 1])
        : null;

      return successResponse({
        supporters,
        total,
        next_cursor: nextCursor,
        has_more: hasMore,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch supporters');
    }
  }
);
