import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * POST /api/announcements/[id]/dismiss
 * Record that the current user has dismissed an announcement.
 * Idempotent via findOrCreate.
 */
export const POST = withAuth(async (
  _req: NextRequest,
  context: AuthContext
) => {
  try {
    const params = await context.params;
    const idParam = params.id;
    const announcementId = parseInt(idParam, 10);

    if (!announcementId || isNaN(announcementId)) {
      return errorResponse('Invalid announcement ID');
    }

    const { Announcement, AnnouncementDismissal } = await import('@/lib/db/models');

    // Verify announcement exists
    const announcement = await Announcement.findByPk(announcementId);
    if (!announcement) {
      return errorResponse('Announcement not found', 404);
    }

    // Idempotent dismissal
    await AnnouncementDismissal.findOrCreate({
      where: {
        user_id: context.user.id,
        announcement_id: announcementId,
      },
      defaults: {
        user_id: context.user.id,
        announcement_id: announcementId,
      },
    });

    return successResponse({ dismissed: true });
  } catch (error) {
    return serverError(error, 'Failed to dismiss announcement');
  }
});
