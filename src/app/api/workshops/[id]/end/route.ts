import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * POST /api/workshops/[id]/end - End a workshop (host only)
 *
 * State transition: live -> ended
 * Stops Agora Cloud Recording automatically (fire-and-forget).
 * Marks all joined attendees as left.
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { Workshop, WorkshopAttendee } = await import('@/lib/db/models');

      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (isNaN(workshopId)) {
        return errorResponse('Invalid workshop ID');
      }

      const userId = context.user.id;

      const workshop = await Workshop.findByPk(workshopId);
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Only host can end a workshop
      if (workshop.host_id !== userId) {
        return errorResponse('Only the host can end this workshop', 403);
      }

      // Can only end a live workshop
      if (workshop.status !== 'live') {
        return errorResponse(
          `Workshop cannot be ended from "${workshop.status}" status`,
          400
        );
      }

      const now = new Date();

      // Update workshop status
      await workshop.update({
        status: 'ended',
        actual_ended_at: now,
      });

      // Fire-and-forget: Stop Cloud Recording
      if (workshop.recording_resource_id && workshop.recording_sid) {
        stopRecordingAsync(
          workshopId,
          workshop.agora_channel!,
          workshop.recording_resource_id,
          workshop.recording_sid
        ).catch((err) => {
          console.error(
            `[Workshop ${workshopId}] Failed to stop cloud recording:`,
            err
          );
        });
      }

      // Fire-and-forget: Broadcast state change via Socket.IO
      broadcastStateChange(workshopId, 'ended', now).catch(() => {});

      // Mark all joined attendees as left
      await WorkshopAttendee.update(
        { status: 'left', left_at: now },
        {
          where: {
            workshop_id: workshopId,
            status: 'joined',
          },
        }
      );

      return successResponse({ workshop: workshop.toJSON() });
    } catch (error) {
      return serverError(error, 'Failed to end workshop');
    }
  }
);

/**
 * Fire-and-forget: Stop Agora Cloud Recording.
 */
async function stopRecordingAsync(
  workshopId: number,
  channelName: string,
  resourceId: string,
  sid: string
): Promise<void> {
  const { stopCloudRecording, getRecordingUid } = await import(
    '@/lib/workshop/cloud-recording'
  );

  const recordingUid = getRecordingUid(workshopId);
  const result = await stopCloudRecording(
    channelName,
    recordingUid,
    resourceId,
    sid
  );

  console.log(
    `[Workshop ${workshopId}] Cloud recording stopped — files: ${result.fileList.length}`
  );
}

/**
 * Fire-and-forget: Broadcast workshop state change via Socket.IO.
 */
async function broadcastStateChange(
  workshopId: number,
  status: string,
  timestamp: Date
): Promise<void> {
  try {
    const { getIO } = await import('@/lib/socket/index');
    const io = getIO();
    io.of('/workshop')
      .to(`workshop:${workshopId}`)
      .emit('workshop:state-changed', {
        workshopId,
        status,
        endedAt: timestamp.toISOString(),
      });
  } catch {
    // Socket.IO may not be initialized in certain environments
  }
}
