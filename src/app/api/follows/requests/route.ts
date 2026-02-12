import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const requestActionSchema = z.object({
  follower_id: z.number().int().positive(),
  action: z.enum(['accept', 'reject']),
});

/**
 * GET /api/follows/requests - List pending follow requests for the authenticated user
 */
export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Follow, User } = await import('@/lib/db/models');

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const where: Record<string, unknown> = {
      following_id: context.user.id,
      status: 'pending',
    };

    if (cursor) {
      const { Op } = await import('sequelize');
      where.id = { [Op.lt]: parseInt(cursor, 10) };
    }

    const requests = await Follow.findAll({
      where,
      include: [
        {
          model: User,
          as: 'follower',
          attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color', 'bio'],
        },
      ],
      order: [['id', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = requests.length > limit;
    const items = hasMore ? requests.slice(0, limit) : requests;
    const nextCursor = hasMore ? items[items.length - 1].id.toString() : null;

    return successResponse({
      requests: items,
      next_cursor: nextCursor,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch follow requests');
  }
});

/**
 * PUT /api/follows/requests - Accept or reject a follow request
 */
export const PUT = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = requestActionSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { follower_id, action } = parsed.data;
    const { Follow } = await import('@/lib/db/models');

    const follow = await Follow.findOne({
      where: {
        follower_id,
        following_id: context.user.id,
        status: 'pending',
      },
    });

    if (!follow) {
      return errorResponse('Follow request not found', 404);
    }

    if (action === 'accept') {
      await follow.update({ status: 'active' });
      return successResponse({ accepted: true });
    } else {
      await follow.destroy();
      return successResponse({ rejected: true });
    }
  } catch (error) {
    return serverError(error, 'Failed to process follow request');
  }
});
