import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/workshops/[id]/token - Generate Agora RTC token for workshop
 *
 * Returns a role-based token:
 * - Host/co-host: PUBLISHER (video + audio)
 * - Approved speaker: PUBLISHER (audio — client decides what to publish)
 * - Attendee: SUBSCRIBER (receive-only)
 *
 * Only issues tokens for live workshops.
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { Workshop, WorkshopAttendee, WorkshopInvite } =
        await import('@/lib/db/models');

      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (isNaN(workshopId)) {
        return errorResponse('Invalid workshop ID');
      }

      const userId = context.user.id;

      // Optional uid override for screen-share (uses a separate Agora client
      // with uid = userId + 100000).  Authorization is still checked against
      // the authenticated user; only the token UID changes.
      const uidParam = req.nextUrl.searchParams.get('uid');
      const tokenUid = uidParam ? parseInt(uidParam, 10) : userId;
      if (isNaN(tokenUid)) {
        return errorResponse('Invalid uid parameter');
      }

      const workshop = await Workshop.findByPk(workshopId);
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Only issue tokens for live workshops
      if (workshop.status !== 'live') {
        return errorResponse(
          'Tokens are only available for live workshops',
          400
        );
      }

      if (!workshop.agora_channel) {
        return errorResponse(
          'Workshop does not have an Agora channel configured',
          500
        );
      }

      // Determine user's role and authorization
      const isHost = workshop.host_id === userId;
      let role: 'host' | 'audience' = 'audience';

      if (isHost) {
        role = 'host';
      } else {
        // Check attendee record
        const attendee = await WorkshopAttendee.findOne({
          where: { workshop_id: workshopId, user_id: userId },
        });

        if (attendee) {
          if (attendee.is_co_host || attendee.can_speak) {
            role = 'host'; // Co-hosts and approved speakers publish
          }
          // Regular RSVP'd attendee stays 'audience'
        } else {
          // Not RSVP'd — check if private workshop requires invite
          if (workshop.is_private) {
            const hasInvite = await WorkshopInvite.findOne({
              where: { workshop_id: workshopId, user_id: userId },
              attributes: ['id'],
            });

            if (!hasInvite) {
              return errorResponse(
                'You do not have access to this private workshop',
                403
              );
            }
          }
          // Public workshop: allow as audience without RSVP
        }
      }

      // Generate token
      const { generateAgoraToken } = await import(
        '@/lib/workshop/agora-token'
      );

      const token = generateAgoraToken(
        workshop.agora_channel,
        tokenUid,
        role
      );

      return successResponse({
        token,
        channelName: workshop.agora_channel,
        uid: tokenUid,
        role,
        appId: process.env.NEXT_PUBLIC_AGORA_APP_ID || '',
      });
    } catch (error) {
      return serverError(error, 'Failed to generate Agora token');
    }
  }
);
