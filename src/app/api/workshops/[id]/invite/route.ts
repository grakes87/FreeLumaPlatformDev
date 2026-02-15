import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const inviteSchema = z.object({
  userIds: z
    .array(z.number().int().positive())
    .min(1, 'At least one user ID required')
    .max(50, 'Cannot invite more than 50 users at once'),
});

/**
 * POST /api/workshops/[id]/invite - Invite users to a workshop (host/co-host only)
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (!workshopId || isNaN(workshopId)) {
        return errorResponse('Valid workshop ID required');
      }

      const userId = context.user.id;

      const json = await req.json();
      const parsed = inviteSchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(
          parsed.error.issues[0]?.message || 'Invalid input'
        );
      }

      const { userIds } = parsed.data;

      const { Workshop, WorkshopAttendee, WorkshopInvite, User } =
        await import('@/lib/db/models');

      // Validate workshop exists
      const workshop = await Workshop.findByPk(workshopId);
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Validate caller is host or co-host
      const isHost = workshop.host_id === userId;
      let isCoHost = false;
      if (!isHost) {
        const attendee = await WorkshopAttendee.findOne({
          where: {
            workshop_id: workshopId,
            user_id: userId,
            is_co_host: true,
          },
        });
        isCoHost = !!attendee;
      }

      if (!isHost && !isCoHost) {
        return errorResponse(
          'Only the host or co-hosts can invite users',
          403
        );
      }

      // Validate each user exists and is active
      const validUsers = await User.findAll({
        where: { id: userIds, status: 'active' },
        attributes: ['id'],
      });
      const validUserIds = validUsers.map((u: { id: number }) => u.id);

      if (validUserIds.length === 0) {
        return errorResponse('No valid active users found');
      }

      // Bulk create invites (ignoreDuplicates for already-invited users)
      const inviteRows = validUserIds.map((uid: number) => ({
        workshop_id: workshopId,
        user_id: uid,
        invited_by: userId,
      }));

      await WorkshopInvite.bulkCreate(inviteRows, {
        ignoreDuplicates: true,
      });

      // Send notifications fire-and-forget
      const { createNotification } = await import(
        '@/lib/notifications/create'
      );
      const { NotificationType, NotificationEntityType } = await import(
        '@/lib/notifications/types'
      );

      for (const uid of validUserIds) {
        createNotification({
          recipient_id: uid,
          actor_id: userId,
          type: NotificationType.WORKSHOP_INVITE,
          entity_type: NotificationEntityType.WORKSHOP,
          entity_id: workshopId,
          preview_text: workshop.title,
        }).catch(() => {});
      }

      return successResponse(
        { invited: validUserIds.length },
        201
      );
    } catch (error) {
      return serverError(error, 'Failed to invite users to workshop');
    }
  }
);
