import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/workshops/[id]/chat - Get chat history for replay
 *
 * Returns messages ordered by offset_ms for time-synced chat replay
 * alongside recorded workshop video.
 *
 * Pagination: ?limit=500&offset=0 (default limit: 500, max: 1000)
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (!workshopId || isNaN(workshopId)) {
        return errorResponse('Valid workshop ID required');
      }

      const { Workshop, WorkshopChat, User } = await import(
        '@/lib/db/models'
      );

      // Validate workshop exists
      const workshop = await Workshop.findByPk(workshopId, {
        attributes: ['id'],
      });
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Parse pagination params
      const { searchParams } = new URL(req.url);
      const limit = Math.min(
        Math.max(parseInt(searchParams.get('limit') || '500', 10) || 500, 1),
        1000
      );
      const offset = Math.max(
        parseInt(searchParams.get('offset') || '0', 10) || 0,
        0
      );

      // Fetch messages ordered by offset_ms with user info
      const { count, rows: messages } = await WorkshopChat.findAndCountAll({
        where: { workshop_id: workshopId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: [
              'id',
              'display_name',
              'username',
              'avatar_url',
              'avatar_color',
            ],
          },
        ],
        order: [['offset_ms', 'ASC']],
        limit,
        offset,
      });

      return successResponse({
        messages: messages.map((msg) => {
          const plain = msg.get({ plain: true }) as unknown as Record<string, unknown>;
          return {
            id: plain.id,
            user_id: plain.user_id,
            message: plain.message,
            offset_ms: plain.offset_ms,
            created_at: plain.created_at,
            user: plain.user,
          };
        }),
        total: count,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch workshop chat history');
    }
  }
);
