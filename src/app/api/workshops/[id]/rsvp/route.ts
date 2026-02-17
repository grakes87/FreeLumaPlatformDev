import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * POST /api/workshops/[id]/rsvp - RSVP to a workshop
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

      const { Workshop, WorkshopAttendee, WorkshopInvite, WorkshopBan } =
        await import('@/lib/db/models');

      // Validate workshop exists and is in RSVP-able state
      const workshop = await Workshop.findByPk(workshopId);
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      if (workshop.status !== 'scheduled') {
        return errorResponse(
          'Can only RSVP to workshops that are scheduled',
          400
        );
      }

      // If private, check user has invite or is the host
      if (workshop.is_private && workshop.host_id !== userId) {
        const invite = await WorkshopInvite.findOne({
          where: { workshop_id: workshopId, user_id: userId },
        });
        if (!invite) {
          return errorResponse(
            'This is a private workshop. You need an invitation to RSVP.',
            403
          );
        }
      }

      // Check if user is banned by this host
      const ban = await WorkshopBan.findOne({
        where: { host_id: workshop.host_id, banned_user_id: userId },
        attributes: ['id'],
      });
      if (ban) {
        return errorResponse(
          'You are not able to join this host\'s workshops',
          403
        );
      }

      // Check capacity
      if (
        workshop.max_capacity !== null &&
        workshop.attendee_count >= workshop.max_capacity
      ) {
        return errorResponse('Workshop is at full capacity', 409);
      }

      // findOrCreate to handle idempotent RSVP
      const [attendee, created] = await WorkshopAttendee.findOrCreate({
        where: { workshop_id: workshopId, user_id: userId },
        defaults: { workshop_id: workshopId, user_id: userId, status: 'rsvp' },
      });

      // Increment attendee count only if newly created (fire-and-forget)
      if (created) {
        Workshop.increment('attendee_count', {
          where: { id: workshopId },
        }).catch(() => {});
      }

      return successResponse(
        {
          rsvp: {
            id: attendee.id,
            workshop_id: attendee.workshop_id,
            user_id: attendee.user_id,
            status: attendee.status,
            created_at: attendee.created_at,
          },
          action: created ? 'created' : 'existing',
        },
        created ? 201 : 200
      );
    } catch (error) {
      return serverError(error, 'Failed to RSVP to workshop');
    }
  }
);

/**
 * DELETE /api/workshops/[id]/rsvp - Un-RSVP from a workshop
 */
export const DELETE = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (!workshopId || isNaN(workshopId)) {
        return errorResponse('Valid workshop ID required');
      }

      const userId = context.user.id;

      const { Workshop, WorkshopAttendee } = await import('@/lib/db/models');

      // Find existing RSVP
      const attendee = await WorkshopAttendee.findOne({
        where: { workshop_id: workshopId, user_id: userId },
      });

      if (!attendee) {
        return errorResponse('RSVP not found', 404);
      }

      // Only allow un-RSVP from 'rsvp' status (not 'joined' or 'left')
      if (attendee.status !== 'rsvp') {
        return errorResponse(
          'Cannot un-RSVP after joining the workshop',
          400
        );
      }

      await attendee.destroy();

      // Decrement attendee count (fire-and-forget)
      Workshop.decrement('attendee_count', {
        where: { id: workshopId },
      }).catch(() => {});

      return successResponse({ action: 'removed' });
    } catch (error) {
      return serverError(error, 'Failed to un-RSVP from workshop');
    }
  }
);
