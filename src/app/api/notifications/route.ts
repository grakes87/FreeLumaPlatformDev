import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import {
  getGroupedNotifications,
  type NotificationFilter,
} from '@/lib/notifications/group';

const VALID_FILTERS = ['all', 'follows', 'reactions', 'comments', 'prayer'] as const;

/**
 * GET /api/notifications
 * Fetch paginated, grouped notification feed.
 * Supports ?count_only=true for lightweight badge updates.
 */
export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);

    // Lightweight badge update mode
    const countOnly = searchParams.get('count_only') === 'true';
    if (countOnly) {
      const { Notification } = await import('@/lib/db/models');
      const unreadCount = await Notification.count({
        where: { recipient_id: context.user.id, is_read: false },
      });
      return successResponse({ unreadCount });
    }

    const cursor = searchParams.get('cursor') ?? undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 50) : 20;
    const filterParam = searchParams.get('filter') ?? 'all';

    if (!VALID_FILTERS.includes(filterParam as NotificationFilter)) {
      return errorResponse('Invalid filter. Must be one of: all, follows, reactions, comments, prayer');
    }

    const result = await getGroupedNotifications(context.user.id, {
      cursor,
      limit,
      filter: filterParam as NotificationFilter,
    });

    return successResponse(result);
  } catch (error) {
    return serverError(error, 'Failed to fetch notifications');
  }
});

/**
 * PUT /api/notifications
 * Mark notifications as read.
 * Body: { action: 'mark-read', notification_id?: number }
 * If notification_id provided: mark single notification as read.
 * If omitted (action: 'mark-all-read'): mark all unread notifications as read.
 */
export const PUT = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const body = await req.json();
    const { action, notification_id } = body;

    if (!action || (action !== 'mark-read' && action !== 'mark-all-read')) {
      return errorResponse('Invalid action. Must be "mark-read" or "mark-all-read"');
    }

    const { Notification } = await import('@/lib/db/models');

    if (notification_id) {
      // Mark single notification as read
      await Notification.update(
        { is_read: true },
        {
          where: {
            id: notification_id,
            recipient_id: context.user.id,
          },
        }
      );
    } else {
      // Mark all unread as read
      await Notification.update(
        { is_read: true },
        {
          where: {
            recipient_id: context.user.id,
            is_read: false,
          },
        }
      );
    }

    // Return updated unread count
    const unreadCount = await Notification.count({
      where: { recipient_id: context.user.id, is_read: false },
    });

    return successResponse({ success: true, unreadCount });
  } catch (error) {
    return serverError(error, 'Failed to update notifications');
  }
});
