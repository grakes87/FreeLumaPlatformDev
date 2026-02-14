import { ActivityStreak } from '@/lib/db/models';
import { getUserLocalDate } from '@/lib/utils/timezone';

export type ActivityType = 'daily_view' | 'audio_listen' | 'video_watch' | 'social_activity';

/**
 * Track a qualifying activity for streak calculation.
 *
 * Uses fire-and-forget pattern — callers should NOT await this.
 * Determines the user's local date via timezone and upserts an ActivityStreak
 * record, appending the activity type to the JSON array if not already present.
 *
 * @param userId - The user's ID
 * @param activityType - The type of activity being tracked
 * @param timezone - IANA timezone string (e.g. "America/New_York"), defaults to UTC
 */
export async function trackActivity(
  userId: number,
  activityType: ActivityType,
  timezone: string = 'UTC'
): Promise<void> {
  try {
    const localDate = getUserLocalDate(timezone);

    const [record, created] = await ActivityStreak.findOrCreate({
      where: { user_id: userId, activity_date: localDate },
      defaults: {
        user_id: userId,
        activity_date: localDate,
        activities: JSON.stringify([activityType]),
      },
    });

    if (!created) {
      // Record already exists — add activity type if not already present
      let activities: string[];
      try {
        activities = JSON.parse(record.activities);
      } catch {
        activities = [];
      }

      if (!activities.includes(activityType)) {
        activities.push(activityType);
        await record.update({ activities: JSON.stringify(activities) });
      }
    }
  } catch (error) {
    // Fire-and-forget: log but never throw
    console.error('[trackActivity] Failed to track activity:', error);
  }
}
