import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';

/**
 * GET /api/admin/audit-log - Searchable moderation log
 *
 * Query params:
 *   admin_id: filter by admin who performed action
 *   action: filter by action type
 *   target_user_id: filter by target user
 *   from: start date (ISO string)
 *   to: end date (ISO string)
 *   search: search reason text (LIKE)
 *   cursor: pagination cursor (log ID)
 *   limit: items per page (default 50, max 100)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { ModerationLog, User } = await import('@/lib/db/models');
    const { searchParams } = new URL(req.url);

    const adminId = searchParams.get('admin_id');
    const action = searchParams.get('action');
    const targetUserId = searchParams.get('target_user_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (adminId) {
      where.admin_id = parseInt(adminId, 10);
    }

    if (action) {
      where.action = action;
    }

    if (targetUserId) {
      where.target_user_id = parseInt(targetUserId, 10);
    }

    if (from || to) {
      where.created_at = {};
      if (from) {
        where.created_at[Op.gte] = new Date(from);
      }
      if (to) {
        where.created_at[Op.lte] = new Date(to);
      }
    }

    if (search) {
      where.reason = { [Op.like]: `%${search.trim()}%` };
    }

    if (cursor) {
      where.id = { ...(where.id || {}), [Op.lt]: parseInt(cursor, 10) };
    }

    const entries = await ModerationLog.findAll({
      where,
      include: [
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'username', 'display_name'],
        },
        {
          model: User,
          as: 'targetUser',
          attributes: ['id', 'username', 'display_name'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = entries.length > limit;
    const paginatedEntries = entries.slice(0, limit);

    const nextCursor = hasMore && paginatedEntries.length > 0
      ? String(paginatedEntries[paginatedEntries.length - 1].id)
      : null;

    const items = paginatedEntries.map((entry) => {
      const json = entry.toJSON() as Record<string, unknown>;
      return {
        id: json.id,
        admin: json.admin,
        action: json.action,
        target_user: json.targetUser || null,
        target_content_type: json.target_content_type,
        target_content_id: json.target_content_id,
        reason: json.reason,
        metadata: json.metadata ? JSON.parse(json.metadata as string) : null,
        created_at: json.created_at,
      };
    });

    return successResponse({
      entries: items,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch audit log');
  }
});
