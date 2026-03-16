import cron from 'node-cron';
import {
  processDMEmailBatch,
  processReactionCommentBatch,
  processDailyReminders,
  cleanupOldNotifications,
  processVideoBroadcast,
} from './queue';

let initialized = false;

/**
 * Initialize email notification cron jobs.
 * Call once from server.js startup (via globalThis pattern).
 *
 * Guards against multiple initializations (e.g., HMR in dev).
 */
export function initEmailScheduler(): void {
  if (initialized || globalThis.__emailSchedulerReady) {
    return;
  }

  // Every 5 minutes: process batched DM email notifications
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { acquireCronLock, releaseCronLock } = await import('./cronLock');
      if (!await acquireCronLock('dm_batch', 4 * 60 * 1000)) {
        console.log('[Email Scheduler] DM batch lock held, skipping');
        return;
      }
      try {
        await processDMEmailBatch();
      } finally {
        await releaseCronLock('dm_batch');
      }
    } catch (err) {
      console.error('[Email Scheduler] DM batch error:', err);
    }
  });

  // Every 5 minutes: process pending video broadcast emails (chunked)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { acquireCronLock, releaseCronLock } = await import('./cronLock');
      if (!await acquireCronLock('video_broadcast', 4 * 60 * 1000)) {
        console.log('[Email Scheduler] Video broadcast lock held, skipping');
        return;
      }
      try {
        await processVideoBroadcast();
      } finally {
        await releaseCronLock('video_broadcast');
      }
    } catch (err) {
      console.error('[Email Scheduler] Video broadcast error:', err);
    }
  });

  // Every 15 minutes: process batched reaction/comment email notifications
  cron.schedule('*/15 * * * *', async () => {
    try {
      const { acquireCronLock, releaseCronLock } = await import('./cronLock');
      if (!await acquireCronLock('reaction_comment_batch', 14 * 60 * 1000)) {
        console.log('[Email Scheduler] Reaction/comment batch lock held, skipping');
        return;
      }
      try {
        await processReactionCommentBatch();
      } finally {
        await releaseCronLock('reaction_comment_batch');
      }
    } catch (err) {
      console.error('[Email Scheduler] Reaction/comment batch error:', err);
    }
  });

  // Top of each hour: send daily content reminder emails
  cron.schedule('0 * * * *', async () => {
    try {
      const { acquireCronLock, releaseCronLock } = await import('./cronLock');
      if (!await acquireCronLock('daily_reminders', 55 * 60 * 1000)) {
        console.log('[Email Scheduler] Daily reminder lock held, skipping');
        return;
      }
      try {
        await processDailyReminders();
      } finally {
        await releaseCronLock('daily_reminders');
      }
    } catch (err) {
      console.error('[Email Scheduler] Daily reminder error:', err);
    }
  });

  // Daily at 3 AM: clean up old notifications and email logs
  cron.schedule('0 3 * * *', async () => {
    try {
      const { acquireCronLock, releaseCronLock } = await import('./cronLock');
      if (!await acquireCronLock('cleanup', 60 * 60 * 1000)) {
        console.log('[Email Scheduler] Cleanup lock held, skipping');
        return;
      }
      try {
        await cleanupOldNotifications();
      } finally {
        await releaseCronLock('cleanup');
      }
    } catch (err) {
      console.error('[Email Scheduler] Cleanup error:', err);
    }
  });

  initialized = true;
  globalThis.__emailSchedulerReady = true;
  console.log('[Email Scheduler] Cron jobs initialized');
}

// Extend globalThis for HMR guard
declare global {
  // eslint-disable-next-line no-var
  var __emailSchedulerReady: boolean | undefined;
  // eslint-disable-next-line no-var
  var __initEmailScheduler: (() => void) | undefined;
}

// Store on globalThis so server.js (plain JS) can call it
globalThis.__initEmailScheduler = initEmailScheduler;
