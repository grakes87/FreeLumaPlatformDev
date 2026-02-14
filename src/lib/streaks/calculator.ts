import { ActivityStreak } from '@/lib/db/models';
import { getUserLocalDate } from '@/lib/utils/timezone';

export interface StreakResult {
  current_streak: number;
  longest_streak: number;
  total_active_days: number;
}

/**
 * Calculate the user's activity streak data.
 *
 * - current_streak: consecutive days backwards from today (or yesterday if no activity today)
 * - longest_streak: maximum consecutive run across all history
 * - total_active_days: total number of days with at least one activity
 *
 * @param userId - The user's ID
 * @param timezone - IANA timezone string for day boundary calculation
 */
export async function calculateStreak(
  userId: number,
  timezone: string = 'UTC'
): Promise<StreakResult> {
  const records = await ActivityStreak.findAll({
    where: { user_id: userId },
    attributes: ['activity_date'],
    order: [['activity_date', 'DESC']],
    raw: true,
  });

  const totalActiveDays = records.length;

  if (totalActiveDays === 0) {
    return { current_streak: 0, longest_streak: 0, total_active_days: 0 };
  }

  // Build a Set of date strings for O(1) lookup
  const dateSet = new Set(records.map((r) => r.activity_date));

  const today = getUserLocalDate(timezone);

  // Current streak: walk backwards from today or yesterday
  let currentStreak = 0;
  let checkDate = today;

  // If no activity today, start from yesterday
  if (!dateSet.has(checkDate)) {
    checkDate = subtractOneDay(checkDate);
    // If no activity yesterday either, current streak is 0
    if (!dateSet.has(checkDate)) {
      // Calculate longest streak from full history
      const longestStreak = computeLongestStreak(records);
      return { current_streak: 0, longest_streak: longestStreak, total_active_days: totalActiveDays };
    }
  }

  // Walk backwards counting consecutive days
  while (dateSet.has(checkDate)) {
    currentStreak++;
    checkDate = subtractOneDay(checkDate);
  }

  // Longest streak: iterate chronologically
  const longestStreak = computeLongestStreak(records);

  return {
    current_streak: currentStreak,
    longest_streak: Math.max(longestStreak, currentStreak),
    total_active_days: totalActiveDays,
  };
}

/**
 * Compute the longest consecutive streak from activity records.
 * Records are expected to be ordered by activity_date DESC.
 */
function computeLongestStreak(records: { activity_date: string }[]): number {
  if (records.length === 0) return 0;

  // Sort chronologically (ASC) for forward iteration
  const sorted = [...records].sort((a, b) => a.activity_date.localeCompare(b.activity_date));

  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = sorted[i - 1].activity_date;
    const currDate = sorted[i].activity_date;
    const nextExpected = addOneDay(prevDate);

    if (currDate === nextExpected) {
      current++;
      if (current > longest) {
        longest = current;
      }
    } else {
      current = 1;
    }
  }

  return longest;
}

/**
 * Subtract one day from a YYYY-MM-DD date string.
 */
function subtractOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}

/**
 * Add one day to a YYYY-MM-DD date string.
 */
function addOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return formatDate(date);
}

/**
 * Format a Date object as YYYY-MM-DD.
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
