import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * POST /api/workshops/[id]/start - Start a workshop (host only)
 *
 * State transition: scheduled|lobby -> live
 * Triggers Agora Cloud Recording automatically (fire-and-forget).
 * Uses DB transaction to prevent race condition with no-show cron.
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { Workshop, WorkshopAttendee, sequelize } =
        await import('@/lib/db/models');

      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (isNaN(workshopId)) {
        return errorResponse('Invalid workshop ID');
      }

      const userId = context.user.id;

      // Pre-check: workshop exists and caller is host
      const workshop = await Workshop.findByPk(workshopId);
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Only the host (not co-hosts) can start a workshop
      if (workshop.host_id !== userId) {
        return errorResponse('Only the host can start this workshop', 403);
      }

      // Pre-check status before entering transaction
      if (workshop.status !== 'scheduled' && workshop.status !== 'lobby') {
        return errorResponse(
          `Workshop cannot be started from "${workshop.status}" status`,
          409
        );
      }

      // Atomic state transition with transaction (race condition guard with no-show cron)
      const now = new Date();
      let updatedWorkshop;

      try {
        updatedWorkshop = await sequelize.transaction(async (t) => {
          // Re-read inside transaction to guard against race condition
          const freshWorkshop = await Workshop.findByPk(workshopId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });

          if (!freshWorkshop) {
            throw new Error('WORKSHOP_NOT_FOUND');
          }

          if (
            freshWorkshop.status !== 'scheduled' &&
            freshWorkshop.status !== 'lobby'
          ) {
            throw new Error('WORKSHOP_ALREADY_STARTED_OR_CANCELLED');
          }

          await freshWorkshop.update(
            {
              status: 'live',
              actual_started_at: now,
            },
            { transaction: t }
          );

          return freshWorkshop;
        });
      } catch (txError) {
        const msg =
          txError instanceof Error ? txError.message : String(txError);
        if (msg === 'WORKSHOP_NOT_FOUND') {
          return errorResponse('Workshop not found', 404);
        }
        if (msg === 'WORKSHOP_ALREADY_STARTED_OR_CANCELLED') {
          return errorResponse(
            'Workshop already started or cancelled',
            409
          );
        }
        throw txError;
      }

      // Fire-and-forget: Start Cloud Recording
      let recordingStarted = false;
      const channelName = updatedWorkshop.agora_channel;

      if (channelName) {
        startRecordingAsync(workshopId, channelName).catch((err) => {
          console.error(
            `[Workshop ${workshopId}] Failed to start cloud recording:`,
            err
          );
        });
        recordingStarted = true; // Optimistically — actual start is async
      }

      // Fire-and-forget: Broadcast state change via Socket.IO
      broadcastStateChange(workshopId, 'live', now).catch(() => {});

      // Fire-and-forget: Notify RSVP'd attendees that workshop started
      notifyWorkshopStarted(workshopId, updatedWorkshop.title, userId).catch(
        () => {}
      );

      return successResponse({
        workshop: updatedWorkshop.toJSON(),
        recording: { started: recordingStarted },
      });
    } catch (error) {
      return serverError(error, 'Failed to start workshop');
    }
  }
);

/**
 * Fire-and-forget: Start Agora Cloud Recording for the workshop.
 * Updates workshop with recording_sid and recording_resource_id on success.
 */
async function startRecordingAsync(
  workshopId: number,
  channelName: string
): Promise<void> {
  const { generateAgoraToken } = await import(
    '@/lib/workshop/agora-token'
  );
  const {
    acquireRecordingResource,
    startCloudRecording,
    getRecordingUid,
  } = await import('@/lib/workshop/cloud-recording');
  const { Workshop } = await import('@/lib/db/models');

  const recordingUid = getRecordingUid(workshopId);

  // Generate token for the recording bot
  const token = generateAgoraToken(channelName, recordingUid, 'host');

  // Acquire -> Start
  const resourceId = await acquireRecordingResource(
    channelName,
    recordingUid
  );
  const { sid } = await startCloudRecording(
    channelName,
    recordingUid,
    token,
    resourceId
  );

  // Persist recording identifiers
  await Workshop.update(
    {
      recording_sid: sid,
      recording_resource_id: resourceId,
    },
    { where: { id: workshopId } }
  );

  console.log(
    `[Workshop ${workshopId}] Cloud recording started — sid: ${sid}`
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
        startedAt: timestamp.toISOString(),
      });
  } catch {
    // Socket.IO may not be initialized in certain environments
  }
}

/**
 * Fire-and-forget: Send WORKSHOP_STARTED notifications to all RSVP'd attendees.
 */
async function notifyWorkshopStarted(
  workshopId: number,
  workshopTitle: string,
  hostId: number
): Promise<void> {
  const { WorkshopAttendee } = await import('@/lib/db/models');
  const { createNotification } = await import(
    '@/lib/notifications/create'
  );
  const { NotificationType, NotificationEntityType } = await import(
    '@/lib/notifications/types'
  );

  const attendees = await WorkshopAttendee.findAll({
    where: { workshop_id: workshopId },
    attributes: ['user_id'],
    raw: true,
  });

  for (const attendee of attendees) {
    try {
      await createNotification({
        recipient_id: attendee.user_id,
        actor_id: hostId,
        type: NotificationType.WORKSHOP_STARTED,
        entity_type: NotificationEntityType.WORKSHOP,
        entity_id: workshopId,
        preview_text: workshopTitle,
      });
    } catch {
      // Non-fatal: continue sending to other attendees
    }
  }
}
