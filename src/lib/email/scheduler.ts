import cron from 'node-cron';
import {
  processDMEmailBatch,
  processDailyReminders,
  cleanupOldNotifications,
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
      await processDMEmailBatch();
    } catch (err) {
      console.error('[Email Scheduler] DM batch error:', err);
    }
  });

  // Top of each hour: send daily content reminder emails
  cron.schedule('0 * * * *', async () => {
    try {
      await processDailyReminders();
    } catch (err) {
      console.error('[Email Scheduler] Daily reminder error:', err);
    }
  });

  // Daily at 3 AM: clean up old notifications and email logs
  cron.schedule('0 3 * * *', async () => {
    try {
      await cleanupOldNotifications();
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
