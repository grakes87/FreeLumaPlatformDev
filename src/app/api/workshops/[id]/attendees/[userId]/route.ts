import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * PUT /api/workshops/[id]/attendees/[userId] - Update attendee properties
 *
 * Host can promote/demote co-host.
 * Host or co-host can approve/revoke speaker.
 * Cannot modify yourself.
 */
export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      const targetUserId = parseInt(params.userId, 10);
      if (!workshopId || isNaN(workshopId)) {
        return errorResponse('Valid workshop ID required');
      }
      if (!targetUserId || isNaN(targetUserId)) {
        return errorResponse('Valid user ID required');
      }

      const callerId = context.user.id;

      // Cannot modify yourself
      if (callerId === targetUserId) {
        return errorResponse('Cannot modify your own attendee properties', 400);
      }

      const { Workshop, WorkshopAttendee, User } =
        await import('@/lib/db/models');

      // Validate workshop exists
      const workshop = await Workshop.findByPk(workshopId, {
        attributes: ['id', 'host_id'],
      });
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      const isHost = workshop.host_id === callerId;

      // Check if caller is co-host (if not host)
      let isCoHost = false;
      if (!isHost) {
        const callerAttendee = await WorkshopAttendee.findOne({
          where: { workshop_id: workshopId, user_id: callerId, is_co_host: true },
          attributes: ['id'],
        });
        isCoHost = !!callerAttendee;
      }

      if (!isHost && !isCoHost) {
        return errorResponse('Only host or co-host can manage attendees', 403);
      }

      // Parse body
      const json = await req.json();
      const { is_co_host, can_speak } = json as {
        is_co_host?: boolean;
        can_speak?: boolean;
      };

      // Validate at least one field provided
      if (is_co_host === undefined && can_speak === undefined) {
        return errorResponse('Provide is_co_host or can_speak to update');
      }

      // Only host can change co-host status
      if (is_co_host !== undefined && !isHost) {
        return errorResponse('Only the host can promote or demote co-hosts', 403);
      }

      // Validate types
      if (is_co_host !== undefined && typeof is_co_host !== 'boolean') {
        return errorResponse('is_co_host must be a boolean');
      }
      if (can_speak !== undefined && typeof can_speak !== 'boolean') {
        return errorResponse('can_speak must be a boolean');
      }

      // Target must be in attendee list (or auto-create when promoting to co-host)
      let targetAttendee = await WorkshopAttendee.findOne({
        where: { workshop_id: workshopId, user_id: targetUserId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
          },
        ],
      });
      if (!targetAttendee && is_co_host === true && isHost) {
        // Host is promoting an invited-but-not-yet-RSVP'd user to co-host.
        // Auto-create the attendee record so the promotion succeeds.
        targetAttendee = await WorkshopAttendee.create({
          workshop_id: workshopId,
          user_id: targetUserId,
          status: 'rsvp',
          is_co_host: true,
        });
        // Reload with user association
        targetAttendee = await WorkshopAttendee.findOne({
          where: { id: targetAttendee.id },
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
            },
          ],
        });
        // Increment attendee count
        await Workshop.increment('attendee_count', {
          where: { id: workshopId },
        });
        return successResponse({
          attendee: {
            ...targetAttendee!.toJSON(),
            is_host: targetUserId === workshop.host_id,
          },
        });
      }
      if (!targetAttendee) {
        return errorResponse('User is not an attendee of this workshop', 404);
      }

      // Build updates
      const updates: Record<string, boolean> = {};
      if (is_co_host !== undefined) updates.is_co_host = is_co_host;
      if (can_speak !== undefined) updates.can_speak = can_speak;

      await targetAttendee.update(updates);

      return successResponse({
        attendee: {
          ...targetAttendee.toJSON(),
          is_host: targetUserId === workshop.host_id,
        },
      });
    } catch (error) {
      return serverError(error, 'Failed to update attendee');
    }
  }
);

/**
 * DELETE /api/workshops/[id]/attendees/[userId] - Remove attendee
 *
 * Host or co-host can remove an attendee.
 * Sets status to 'left' and left_at to now, decrements attendee_count.
 */
export const DELETE = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      const targetUserId = parseInt(params.userId, 10);
      if (!workshopId || isNaN(workshopId)) {
        return errorResponse('Valid workshop ID required');
      }
      if (!targetUserId || isNaN(targetUserId)) {
        return errorResponse('Valid user ID required');
      }

      const callerId = context.user.id;

      const { Workshop, WorkshopAttendee } =
        await import('@/lib/db/models');

      // Validate workshop exists
      const workshop = await Workshop.findByPk(workshopId, {
        attributes: ['id', 'host_id'],
      });
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Cannot remove the host
      if (targetUserId === workshop.host_id) {
        return errorResponse('Cannot remove the workshop host', 400);
      }

      const isHost = workshop.host_id === callerId;

      // Check if caller is co-host (if not host)
      let isCoHost = false;
      if (!isHost) {
        const callerAttendee = await WorkshopAttendee.findOne({
          where: { workshop_id: workshopId, user_id: callerId, is_co_host: true },
          attributes: ['id'],
        });
        isCoHost = !!callerAttendee;
      }

      if (!isHost && !isCoHost) {
        return errorResponse('Only host or co-host can remove attendees', 403);
      }

      // Co-host cannot remove another co-host (only host can)
      const targetAttendee = await WorkshopAttendee.findOne({
        where: { workshop_id: workshopId, user_id: targetUserId },
      });
      if (!targetAttendee) {
        return errorResponse('User is not an attendee of this workshop', 404);
      }

      if (targetAttendee.is_co_host && !isHost) {
        return errorResponse('Only the host can remove a co-host', 403);
      }

      // Mark as left
      await targetAttendee.update({
        status: 'left',
        left_at: new Date(),
      });

      // Decrement attendee count (fire-and-forget)
      Workshop.decrement('attendee_count', {
        where: { id: workshopId },
      }).catch(() => {});

      return successResponse({ removed: true });
    } catch (error) {
      return serverError(error, 'Failed to remove attendee');
    }
  }
);
