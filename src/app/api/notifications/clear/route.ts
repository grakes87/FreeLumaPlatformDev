import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * DELETE /api/notifications/clear
 * Delete all notifications for the authenticated user.
 * Hard delete -- notifications older than 30 days would be auto-cleaned anyway.
 */
export const DELETE = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Notification } = await import('@/lib/db/models');

    await Notification.destroy({
      where: { recipient_id: context.user.id },
    });

    return successResponse({ success: true });
  } catch (error) {
    return serverError(error, 'Failed to clear notifications');
  }
});
