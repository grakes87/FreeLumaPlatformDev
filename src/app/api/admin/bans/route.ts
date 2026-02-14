import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';
import { createNotification } from '@/lib/notifications/create';
import { NotificationType, NotificationEntityType } from '@/lib/notifications/types';

const createBanSchema = z.object({
  user_id: z.number().int().positive(),
  reason: z.string().min(1).max(2000),
  duration: z.enum(['24h', '7d', '30d', 'permanent']),
});

/**
 * GET /api/admin/bans - List bans
 *
 * Query params:
 *   active: 'true' to show only active bans
 *   cursor: pagination cursor (ban ID)
 *   limit: items per page (default 20, max 50)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { Ban, User } = await import('@/lib/db/models');
    const { searchParams } = new URL(req.url);

    const active = searchParams.get('active');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (active === 'true') {
      where.lifted_at = null;
      where[Op.or] = [
        { expires_at: null },
        { expires_at: { [Op.gt]: new Date() } },
      ];
    }

    if (cursor) {
      where.id = { ...(where.id || {}), [Op.lt]: parseInt(cursor, 10) };
    }

    const bans = await Ban.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'status'],
        },
        {
          model: User,
          as: 'bannedBy',
          attributes: ['id', 'username', 'display_name'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = bans.length > limit;
    const paginatedBans = bans.slice(0, limit);
    const nextCursor = hasMore && paginatedBans.length > 0
      ? String(paginatedBans[paginatedBans.length - 1].id)
      : null;

    return successResponse({
      bans: paginatedBans.map((b) => b.toJSON()),
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch bans');
  }
});

/**
 * POST /api/admin/bans - Create a ban
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Ban, User, ModerationLog, sequelize } = await import('@/lib/db/models');

    const json = await req.json();
    const parsed = createBanSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { user_id, reason, duration } = parsed.data;
    const adminId = context.user.id;

    // Verify user exists
    const user = await User.findByPk(user_id, { attributes: ['id', 'status'] });
    if (!user) {
      return errorResponse('User not found', 404);
    }

    if (user.status === 'banned') {
      return errorResponse('User is already banned', 409);
    }

    // Calculate expires_at
    let expiresAt: Date | null = null;
    if (duration !== 'permanent') {
      expiresAt = new Date();
      switch (duration) {
        case '24h':
          expiresAt.setHours(expiresAt.getHours() + 24);
          break;
        case '7d':
          expiresAt.setDate(expiresAt.getDate() + 7);
          break;
        case '30d':
          expiresAt.setDate(expiresAt.getDate() + 30);
          break;
      }
    }

    const transaction = await sequelize.transaction();

    try {
      // Create ban
      const ban = await Ban.create(
        {
          user_id,
          banned_by: adminId,
          reason,
          duration,
          expires_at: expiresAt,
        },
        { transaction }
      );

      // Update user status
      await User.update(
        { status: 'banned' },
        { where: { id: user_id }, transaction }
      );

      // Log action
      await ModerationLog.create(
        {
          admin_id: adminId,
          action: 'ban_user',
          target_user_id: user_id,
          reason,
          metadata: JSON.stringify({ duration, expires_at: expiresAt }),
        },
        { transaction }
      );

      await transaction.commit();

      // Notify user (non-fatal)
      try {
        const durationText = duration === 'permanent' ? 'permanently' : `for ${duration}`;
        await createNotification({
          recipient_id: user_id,
          actor_id: adminId,
          type: NotificationType.BAN,
          entity_type: NotificationEntityType.POST,
          entity_id: user_id,
          preview_text: `You have been banned ${durationText}: ${reason}`,
        });
      } catch { /* non-fatal */ }

      return successResponse({ success: true, ban: ban.toJSON() }, 201);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    return serverError(error, 'Failed to create ban');
  }
});
