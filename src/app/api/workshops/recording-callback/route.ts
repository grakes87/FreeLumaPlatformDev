import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/workshops/recording-callback - Agora Cloud Recording webhook
 *
 * Handles Agora's recording event notifications (no auth — public webhook).
 *
 * Event types:
 * - 31: Recording uploaded successfully
 * - 40: Recording service error
 *
 * On successful upload (eventType 31):
 * 1. Extracts MP4 recording URL from file list
 * 2. Updates workshop with recording_url
 * 3. Creates a Video entry in the video library
 * 4. Notifies attendees that recording is available
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { eventType, payload } = body as {
      noticeId?: string;
      productId?: number;
      eventType?: number;
      payload?: {
        cname?: string;
        uid?: string;
        sid?: string;
        sequence?: number;
        sendts?: number;
        serviceType?: number;
        details?: {
          msgName?: string;
          fileList?: string;
        };
      };
    };

    // Validate basic structure
    if (eventType === undefined || !payload) {
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    const channelName = payload.cname;

    // Validate channel name matches a workshop pattern
    if (!channelName || !channelName.startsWith('workshop-')) {
      console.warn(
        `[Recording Callback] Unknown channel: ${channelName}`
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    switch (eventType) {
      case 31: {
        // Recording uploaded successfully
        await handleRecordingUploaded(channelName, payload);
        break;
      }

      case 40: {
        // Recording service error
        console.error(
          `[Recording Callback] Service error for channel ${channelName}:`,
          JSON.stringify(payload)
        );
        break;
      }

      default: {
        // Other event types — acknowledge but don't process
        console.log(
          `[Recording Callback] Unhandled eventType ${eventType} for ${channelName}`
        );
      }
    }

    // Agora expects 200 response
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Recording Callback] Error processing webhook:', error);
    // Return 200 even on error to prevent Agora from retrying indefinitely
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

/**
 * Handle eventType 31: Recording uploaded.
 * Creates a Video entry and notifies attendees.
 */
async function handleRecordingUploaded(
  channelName: string,
  payload: {
    cname?: string;
    details?: {
      fileList?: string;
    };
  }
): Promise<void> {
  const { Workshop, Video, WorkshopAttendee } = await import(
    '@/lib/db/models'
  );

  // Find workshop by agora_channel
  const workshop = await Workshop.findOne({
    where: { agora_channel: channelName },
  });

  if (!workshop) {
    console.warn(
      `[Recording Callback] No workshop found for channel: ${channelName}`
    );
    return;
  }

  // Parse file list from payload
  let fileList: Array<{ fileName: string; trackType?: string }> = [];
  if (payload.details?.fileList) {
    try {
      fileList =
        typeof payload.details.fileList === 'string'
          ? JSON.parse(payload.details.fileList)
          : payload.details.fileList;
    } catch {
      console.error(
        `[Recording Callback] Failed to parse fileList for workshop ${workshop.id}`
      );
      return;
    }
  }

  // Find MP4 file from the file list
  const mp4File = fileList.find((f) =>
    f.fileName?.toLowerCase().endsWith('.mp4')
  );

  if (!mp4File) {
    console.warn(
      `[Recording Callback] No MP4 file found in fileList for workshop ${workshop.id}`
    );
    return;
  }

  // Construct recording URL from B2 CDN
  const cdnDomain = process.env.B2_CDN_DOMAIN;
  const bucketName = process.env.B2_BUCKET_NAME;
  let recordingUrl: string;

  if (cdnDomain) {
    recordingUrl = `https://${cdnDomain}/${mp4File.fileName}`;
  } else if (bucketName) {
    const region = process.env.B2_REGION || 'us-west-004';
    recordingUrl = `https://${bucketName}.s3.${region}.backblazeb2.com/${mp4File.fileName}`;
  } else {
    recordingUrl = mp4File.fileName;
  }

  // Update workshop with recording URL
  await workshop.update({ recording_url: recordingUrl });

  // Calculate duration from actual start/end times
  let durationSeconds = 0;
  if (workshop.actual_started_at && workshop.actual_ended_at) {
    durationSeconds = Math.round(
      (new Date(workshop.actual_ended_at).getTime() -
        new Date(workshop.actual_started_at).getTime()) /
        1000
    );
  }

  // Create a Video entry in the video library
  const video = await Video.create({
    title: `${workshop.title} (Recording)`,
    description: workshop.description,
    video_url: recordingUrl,
    uploaded_by: workshop.host_id,
    duration_seconds: durationSeconds,
    published: true,
    published_at: new Date(),
    category_id: null, // Workshop categories don't map 1:1 to video categories
  });

  console.log(
    `[Recording Callback] Created video ${video.id} for workshop ${workshop.id}`
  );

  // Fire-and-forget: Notify all RSVP'd attendees that recording is available
  notifyRecordingAvailable(
    workshop.id,
    workshop.title,
    workshop.host_id
  ).catch((err) => {
    console.error(
      `[Recording Callback] Failed to send notifications for workshop ${workshop.id}:`,
      err
    );
  });
}

/**
 * Fire-and-forget: Send WORKSHOP_RECORDING notifications to all attendees.
 */
async function notifyRecordingAvailable(
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
        type: NotificationType.WORKSHOP_RECORDING,
        entity_type: NotificationEntityType.WORKSHOP,
        entity_id: workshopId,
        preview_text: `${workshopTitle} recording is now available`,
      });
    } catch {
      // Non-fatal: continue sending to other attendees
    }
  }
}
