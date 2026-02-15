/**
 * Workshop cron scheduler — reminders, no-show auto-cancel, and series instance generation.
 *
 * Follows the established cron patterns from:
 * - src/lib/email/scheduler.ts (globalThis guard, node-cron)
 * - src/lib/cron/accountCleanup.ts (lazy model imports, try/catch per job)
 *
 * Three cron jobs:
 * 1. RSVP Reminders: Every 5 minutes — sends 1h and 15min pre-workshop notifications
 * 2. No-Show Auto-Cancel: Every minute — cancels workshops 15min past start with no host
 * 3. Series Instance Generation: Daily at 4 AM UTC — creates future workshop instances
 */

import cron from 'node-cron';
import { Op, type Sequelize } from 'sequelize';

let initialized = false;

/**
 * Initialize workshop cron jobs.
 * Call once from server startup (via globalThis pattern).
 * Guards against multiple initializations in HMR.
 */
export function initWorkshopCrons(): void {
  if (initialized || globalThis.__workshopCronsReady) {
    return;
  }

  // -----------------------------------------------------------------------
  // Cron 1: RSVP Reminders (every 5 minutes)
  // -----------------------------------------------------------------------
  cron.schedule('*/5 * * * *', async () => {
    try {
      await sendWorkshopReminders();
    } catch (err) {
      console.error('[Workshop Crons] Reminder error:', err);
    }
  });

  // -----------------------------------------------------------------------
  // Cron 2: No-Show Auto-Cancel (every minute)
  // -----------------------------------------------------------------------
  cron.schedule('* * * * *', async () => {
    try {
      await handleNoShowCancellations();
    } catch (err) {
      console.error('[Workshop Crons] No-show cancel error:', err);
    }
  });

  // -----------------------------------------------------------------------
  // Cron 3: Series Instance Generation (daily at 4 AM UTC)
  // -----------------------------------------------------------------------
  cron.schedule('0 4 * * *', async () => {
    try {
      await generateSeriesInstances();
    } catch (err) {
      console.error('[Workshop Crons] Series generation error:', err);
    }
  });

  initialized = true;
  globalThis.__workshopCronsReady = true;
  console.log(
    '[Workshop Crons] Initialized (reminders 5min, no-show 1min, series daily 4am UTC)'
  );
}

// ---------------------------------------------------------------------------
// Cron 1: RSVP Reminders
// ---------------------------------------------------------------------------

/**
 * Send 1-hour and 15-minute reminders for upcoming workshops.
 * Skips if notification already sent (checked via group_key pattern).
 */
async function sendWorkshopReminders(): Promise<void> {
  const { Workshop } = await import('@/lib/db/models/Workshop');
  const { WorkshopAttendee } = await import(
    '@/lib/db/models/WorkshopAttendee'
  );
  const { Notification } = await import('@/lib/db/models/Notification');
  const { createNotification } = await import('@/lib/notifications/create');
  const {
    NotificationType,
    NotificationEntityType,
  } = await import('@/lib/notifications/types');

  const now = new Date();

  // ----- 1-Hour Reminder Window (55min to 65min from now) -----
  const oneHourFrom = new Date(now.getTime() + 55 * 60 * 1000);
  const oneHourTo = new Date(now.getTime() + 65 * 60 * 1000);

  const workshopsFor1h = await Workshop.findAll({
    where: {
      status: 'scheduled',
      scheduled_at: { [Op.between]: [oneHourFrom, oneHourTo] },
    },
    attributes: ['id', 'title', 'host_id', 'scheduled_at'],
  });

  for (const workshop of workshopsFor1h) {
    const groupKey = `workshop_reminder:workshop:${workshop.id}:1h`;

    // Check if we already sent this reminder
    const existing = await Notification.findOne({
      where: { group_key: groupKey },
      attributes: ['id'],
    });
    if (existing) continue;

    // Get all RSVP'd attendees
    const attendees = await WorkshopAttendee.findAll({
      where: { workshop_id: workshop.id, status: 'rsvp' },
      attributes: ['user_id'],
    });

    for (const attendee of attendees) {
      try {
        await createNotification({
          recipient_id: attendee.user_id,
          actor_id: workshop.host_id,
          type: NotificationType.WORKSHOP_REMINDER,
          entity_type: NotificationEntityType.WORKSHOP,
          entity_id: workshop.id,
          preview_text: `"${workshop.title}" starts in about 1 hour`,
          group_key: groupKey,
        });
      } catch {
        // Non-fatal: individual notification failure shouldn't stop batch
      }
    }
  }

  // ----- 15-Minute Reminder Window (10min to 20min from now) -----
  const fifteenMinFrom = new Date(now.getTime() + 10 * 60 * 1000);
  const fifteenMinTo = new Date(now.getTime() + 20 * 60 * 1000);

  const workshopsFor15m = await Workshop.findAll({
    where: {
      status: 'scheduled',
      scheduled_at: { [Op.between]: [fifteenMinFrom, fifteenMinTo] },
    },
    attributes: ['id', 'title', 'host_id', 'scheduled_at'],
  });

  for (const workshop of workshopsFor15m) {
    const groupKey = `workshop_reminder:workshop:${workshop.id}:15m`;

    const existing = await Notification.findOne({
      where: { group_key: groupKey },
      attributes: ['id'],
    });
    if (existing) continue;

    const attendees = await WorkshopAttendee.findAll({
      where: { workshop_id: workshop.id, status: 'rsvp' },
      attributes: ['user_id'],
    });

    for (const attendee of attendees) {
      try {
        await createNotification({
          recipient_id: attendee.user_id,
          actor_id: workshop.host_id,
          type: NotificationType.WORKSHOP_REMINDER,
          entity_type: NotificationEntityType.WORKSHOP,
          entity_id: workshop.id,
          preview_text: `"${workshop.title}" starts in about 15 minutes`,
          group_key: groupKey,
        });
      } catch {
        // Non-fatal
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cron 2: No-Show Auto-Cancel
// ---------------------------------------------------------------------------

/**
 * Auto-cancel workshops that are 15+ minutes past scheduled start
 * but still in 'scheduled' status (host never started).
 *
 * Uses a database transaction with re-read inside to prevent race
 * conditions with the host starting the workshop at the same time
 * (pitfall 9 from research).
 */
async function handleNoShowCancellations(): Promise<void> {
  const { sequelize } = await import('@/lib/db');
  const { Workshop } = await import('@/lib/db/models/Workshop');
  const { WorkshopAttendee } = await import(
    '@/lib/db/models/WorkshopAttendee'
  );
  const { createNotification } = await import('@/lib/notifications/create');
  const {
    NotificationType,
    NotificationEntityType,
  } = await import('@/lib/notifications/types');

  const cutoff = new Date(Date.now() - 15 * 60 * 1000);

  // Find workshops past the 15-minute no-show window
  const noShowWorkshops = await Workshop.findAll({
    where: {
      status: 'scheduled',
      scheduled_at: { [Op.lt]: cutoff },
    },
    attributes: ['id', 'title', 'host_id'],
  });

  for (const ws of noShowWorkshops) {
    try {
      await (sequelize as Sequelize).transaction(async (t) => {
        // Re-read status inside transaction (race condition guard)
        const fresh = await Workshop.findByPk(ws.id, {
          attributes: ['id', 'status', 'title', 'host_id'],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!fresh || fresh.status !== 'scheduled') {
          // Already transitioned (host started or another cancel), skip
          return;
        }

        // Cancel the workshop
        await fresh.update({ status: 'cancelled' }, { transaction: t });
      });

      // After transaction commits, send notifications (non-fatal)
      const attendees = await WorkshopAttendee.findAll({
        where: { workshop_id: ws.id, status: 'rsvp' },
        attributes: ['user_id'],
      });

      for (const attendee of attendees) {
        try {
          await createNotification({
            recipient_id: attendee.user_id,
            actor_id: ws.host_id,
            type: NotificationType.WORKSHOP_CANCELLED,
            entity_type: NotificationEntityType.WORKSHOP,
            entity_id: ws.id,
            preview_text: `"${ws.title}" was cancelled (host did not start)`,
            group_key: `workshop_cancelled:workshop:${ws.id}`,
          });
        } catch {
          // Non-fatal
        }
      }

      console.log(
        `[Workshop Crons] Auto-cancelled workshop ${ws.id} "${ws.title}" (no-show)`
      );
    } catch (err) {
      console.error(
        `[Workshop Crons] Failed to auto-cancel workshop ${ws.id}:`,
        err
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Cron 3: Series Instance Generation
// ---------------------------------------------------------------------------

/**
 * Generate future workshop instances from active recurring series.
 * Runs daily to maintain a rolling 90-day horizon of scheduled instances.
 *
 * For each active series:
 * 1. Find the latest existing instance (MAX scheduled_at)
 * 2. If that instance is within 30 days from now, generate new instances
 * 3. Use generateInstancesInTimezone() for DST-safe date generation
 * 4. Create Workshop rows for each new date
 */
async function generateSeriesInstances(): Promise<void> {
  const { sequelize } = await import('@/lib/db');
  const { WorkshopSeries } = await import(
    '@/lib/db/models/WorkshopSeries'
  );
  const { Workshop } = await import('@/lib/db/models/Workshop');
  const { generateInstancesInTimezone } = await import(
    '@/lib/workshop/recurrence'
  );

  const now = new Date();
  const thirtyDaysFromNow = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000
  );

  // Find all active series
  const activeSeries = await WorkshopSeries.findAll({
    where: { is_active: true },
  });

  for (const series of activeSeries) {
    try {
      // Find the latest scheduled instance for this series
      const latestInstance = await Workshop.findOne({
        where: { series_id: series.id },
        order: [['scheduled_at', 'DESC']],
        attributes: ['scheduled_at'],
      });

      const latestDate = latestInstance?.scheduled_at ?? now;

      // Only generate if the latest instance is within 30 days
      if (latestDate > thirtyDaysFromNow) {
        continue;
      }

      // Generate new instance dates starting from after the latest
      const startFrom = new Date(
        Math.max(latestDate.getTime(), now.getTime())
      );

      const newDates = generateInstancesInTimezone(
        series.rrule,
        series.time_of_day,
        series.timezone,
        startFrom,
        90
      );

      // Filter out dates that already have instances (avoid duplicates)
      // Also filter out past dates
      const existingDates = new Set<string>();
      if (latestInstance) {
        const allInstances = await Workshop.findAll({
          where: { series_id: series.id },
          attributes: ['scheduled_at'],
        });
        for (const inst of allInstances) {
          existingDates.add(inst.scheduled_at.toISOString());
        }
      }

      const datesToCreate = newDates.filter(
        (d) => d > now && !existingDates.has(d.toISOString())
      );

      // Create Workshop rows for each new date
      for (const date of datesToCreate) {
        const newWorkshop = await Workshop.create({
          series_id: series.id,
          host_id: series.host_id,
          category_id: series.category_id,
          title: series.title,
          description: series.description,
          scheduled_at: date,
          duration_minutes: series.duration_minutes,
          status: 'scheduled',
          is_private: false,
        });

        // Set agora_channel after creation (needs the ID)
        await newWorkshop.update({
          agora_channel: `workshop-${newWorkshop.id}`,
        });
      }

      if (datesToCreate.length > 0) {
        console.log(
          `[Workshop Crons] Generated ${datesToCreate.length} new instance(s) for series ${series.id} "${series.title}"`
        );
      }
    } catch (err) {
      console.error(
        `[Workshop Crons] Failed to generate instances for series ${series.id}:`,
        err
      );
    }
  }
}

// ---------------------------------------------------------------------------
// globalThis type extension for HMR guard
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __workshopCronsReady: boolean | undefined;
  // eslint-disable-next-line no-var
  var __initWorkshopCrons: (() => void) | undefined;
}

// Store on globalThis so server.js (plain JS) can call it
globalThis.__initWorkshopCrons = initWorkshopCrons;
