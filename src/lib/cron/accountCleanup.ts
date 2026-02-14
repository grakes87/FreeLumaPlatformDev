import cron from 'node-cron';
import { Op } from 'sequelize';

const GRACE_PERIOD_DAYS = 30;

let initialized = false;

/**
 * Initialize account cleanup cron job.
 * Runs daily at 3 AM UTC to permanently delete accounts whose
 * 30-day grace period has expired.
 *
 * Guards against multiple initializations (e.g., HMR in dev).
 */
export function initAccountCleanup(): void {
  if (initialized || globalThis.__accountCleanupReady) {
    return;
  }

  // Daily at 3 AM UTC
  cron.schedule('0 3 * * *', async () => {
    try {
      await runAccountCleanup();
    } catch (err) {
      console.error('[Account Cleanup] Cron error:', err);
    }
  });

  initialized = true;
  globalThis.__accountCleanupReady = true;
  console.log('[Account Cleanup] Cron job initialized (daily at 3 AM UTC)');
}

/**
 * Run the account cleanup process.
 * Finds users with status='pending_deletion' whose grace period has expired,
 * anonymizes their content, and permanently deletes the user record.
 */
export async function runAccountCleanup(): Promise<void> {
  const { User, Post, PostComment, DailyComment, DailyReaction } =
    await import('@/lib/db/models');

  const cutoffDate = new Date(
    Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  );

  // Find users whose deletion grace period has expired
  const usersToDelete = await User.findAll({
    where: {
      status: 'pending_deletion',
      deletion_requested_at: {
        [Op.lt]: cutoffDate,
      },
    },
    attributes: ['id', 'email', 'display_name'],
  });

  if (usersToDelete.length === 0) {
    return;
  }

  console.log(
    `[Account Cleanup] Found ${usersToDelete.length} account(s) to permanently delete`
  );

  for (const user of usersToDelete) {
    try {
      // Anonymize content: set user_id to 0 (sentinel "Deleted User")
      // This preserves the content while removing user attribution
      const DELETED_USER_ID = 0;

      await Post.update(
        { user_id: DELETED_USER_ID },
        { where: { user_id: user.id }, paranoid: false }
      );

      await PostComment.update(
        { user_id: DELETED_USER_ID },
        { where: { user_id: user.id } }
      );

      await DailyComment.update(
        { user_id: DELETED_USER_ID },
        { where: { user_id: user.id } }
      );

      // DailyReactions can just be deleted (no need to anonymize reactions)
      await DailyReaction.destroy({
        where: { user_id: user.id },
      });

      // Hard-delete the user (force: true bypasses paranoid soft-delete)
      // FK cascades handle: user_categories, user_settings, push_subscriptions,
      // follows, blocks, bookmarks, reposts, notifications, etc.
      await user.destroy({ force: true });

      console.log(
        `[Account Cleanup] Permanently deleted user ${user.id} (${user.email})`
      );
    } catch (err) {
      console.error(
        `[Account Cleanup] Failed to delete user ${user.id}:`,
        err
      );
    }
  }
}

// Extend globalThis for HMR guard
declare global {
  // eslint-disable-next-line no-var
  var __accountCleanupReady: boolean | undefined;
  // eslint-disable-next-line no-var
  var __initAccountCleanup: (() => void) | undefined;
}

// Store on globalThis so server.js (plain JS) can call it
globalThis.__initAccountCleanup = initAccountCleanup;
