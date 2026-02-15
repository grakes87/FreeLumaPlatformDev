import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/workshops/[id]/attendees - List attendees for a workshop
 *
 * Any authenticated user can view attendees for public workshops.
 * For private workshops, only host/co-host/invited/RSVP'd users.
 * Returns sorted list: host first, then co-hosts, then by joined_at.
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (!workshopId || isNaN(workshopId)) {
        return errorResponse('Valid workshop ID required');
      }

      const userId = context.user.id;

      const { Workshop, WorkshopAttendee, WorkshopInvite, User } =
        await import('@/lib/db/models');

      // Validate workshop exists
      const workshop = await Workshop.findByPk(workshopId, {
        attributes: ['id', 'host_id', 'is_private'],
      });
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Access control for private workshops
      if (workshop.is_private) {
        const isHost = workshop.host_id === userId;
        if (!isHost) {
          // Check if user is co-host, has RSVP, or was invited
          const isAttendee = await WorkshopAttendee.findOne({
            where: { workshop_id: workshopId, user_id: userId },
            attributes: ['id'],
          });
          if (!isAttendee) {
            const hasInvite = await WorkshopInvite.findOne({
              where: { workshop_id: workshopId, user_id: userId },
              attributes: ['id'],
            });
            if (!hasInvite) {
              return errorResponse('Workshop not found', 404);
            }
          }
        }
      }

      // Fetch all attendees with user info
      const attendees = await WorkshopAttendee.findAll({
        where: { workshop_id: workshopId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
          },
        ],
        attributes: ['id', 'user_id', 'status', 'joined_at', 'left_at', 'is_co_host', 'can_speak', 'created_at'],
      });

      // Sort: host first, then co-hosts, then by joined_at/created_at
      const hostId = workshop.host_id;
      const sorted = [...attendees].sort((a, b) => {
        // Host always first
        if (a.user_id === hostId) return -1;
        if (b.user_id === hostId) return 1;

        // Co-hosts next
        if (a.is_co_host && !b.is_co_host) return -1;
        if (!a.is_co_host && b.is_co_host) return 1;

        // Then by joined_at (nulls last)
        const aTime = a.joined_at?.getTime() ?? a.created_at.getTime();
        const bTime = b.joined_at?.getTime() ?? b.created_at.getTime();
        return aTime - bTime;
      });

      const attendeeList = sorted.map((a) => {
        const json = a.toJSON() as unknown as Record<string, unknown>;
        return {
          ...json,
          is_host: a.user_id === hostId,
        };
      });

      return successResponse({
        attendees: attendeeList,
        total: attendeeList.length,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch attendees');
    }
  }
);
