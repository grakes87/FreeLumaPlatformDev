/**
 * Database-level cron execution lock using platform_settings.
 * Prevents overlapping cron runs across PM2 restarts / process boundaries.
 *
 * Each cron job stores a timestamp when it starts. If the timestamp is
 * within maxAgeMs, the lock is considered held and the new execution skips.
 * If the timestamp is older than maxAgeMs, the lock is considered stale
 * (previous process died) and can be acquired.
 */

export async function acquireCronLock(jobName: string, maxAgeMs: number): Promise<boolean> {
  const { PlatformSetting } = await import('@/lib/db/models');
  const key = `cron_lock_${jobName}`;

  const existing = await PlatformSetting.get(key);
  if (existing) {
    const lockTime = parseInt(existing, 10);
    if (!isNaN(lockTime) && Date.now() - lockTime < maxAgeMs) {
      return false; // Lock still held by another process
    }
    // Lock expired (stale), safe to acquire
  }

  await PlatformSetting.set(key, String(Date.now()));
  return true;
}

export async function releaseCronLock(jobName: string): Promise<void> {
  const { PlatformSetting } = await import('@/lib/db/models');
  const key = `cron_lock_${jobName}`;
  // Delete the lock entry rather than setting to empty
  await PlatformSetting.destroy({ where: { key } });
}
