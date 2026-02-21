import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/announcements/active
 * Returns active, in-schedule, mode-matched, undismissed announcements for the current user.
 * Ordered by priority DESC, created_at DESC. Limited to 5.
 */
export const GET = withAuth(async (_req: NextRequest, context: AuthContext) => {
  try {
    const { Announcement, AnnouncementDismissal, User } = await import('@/lib/db/models');
    const { Op } = await import('sequelize');

    // Get user's mode
    const user = await User.findByPk(context.user.id, {
      attributes: ['id', 'mode'],
    });

    if (!user) {
      return successResponse({ announcements: [] });
    }

    const userMode = user.mode || 'bible';
    const now = new Date();

    // Get IDs already dismissed by this user
    const dismissedRows = await AnnouncementDismissal.findAll({
      where: { user_id: context.user.id },
      attributes: ['announcement_id'],
      raw: true,
    });
    const dismissedIds = dismissedRows.map((r) => r.announcement_id);

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      active: true,
      target_mode: { [Op.in]: ['all', userMode] },
      [Op.and]: [
        {
          [Op.or]: [
            { starts_at: null },
            { starts_at: { [Op.lte]: now } },
          ],
        },
        {
          [Op.or]: [
            { expires_at: null },
            { expires_at: { [Op.gt]: now } },
          ],
        },
      ],
    };

    if (dismissedIds.length > 0) {
      where.id = { [Op.notIn]: dismissedIds };
    }

    const announcements = await Announcement.findAll({
      where,
      order: [
        ['priority', 'DESC'],
        ['created_at', 'DESC'],
      ],
      limit: 5,
    });

    return successResponse({ announcements });
  } catch (error) {
    return serverError(error, 'Failed to fetch active announcements');
  }
});
