/**
 * RRULE recurrence helpers for workshop series.
 *
 * Uses the `rrule` npm package (RFC 5545 iCalendar standard) to generate
 * recurring workshop instance dates. Handles timezone awareness via date-fns-tz
 * so that hosts' intended local times are preserved across DST transitions.
 *
 * @see https://www.npmjs.com/package/rrule
 */

import { RRule, Frequency } from 'rrule';
import { fromZonedTime } from 'date-fns-tz';

// ---------------------------------------------------------------------------
// Core RRULE Helpers
// ---------------------------------------------------------------------------

/**
 * Generate recurring instance dates within a horizon window.
 *
 * @param rruleString - RRULE parameters (e.g., "FREQ=WEEKLY;BYDAY=MO")
 * @param startDate - The earliest date to generate instances from
 * @param horizonDays - How many days forward to generate (default: 90)
 * @returns Array of Date objects for each occurrence
 */
export function generateInstances(
  rruleString: string,
  startDate: Date,
  horizonDays: number = 90
): Date[] {
  const rule = RRule.fromString(normalizeRRule(rruleString));
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + horizonDays);

  return rule.between(startDate, endDate, true);
}

/**
 * Get the next occurrence after a given date.
 *
 * @param rruleString - RRULE parameters
 * @param afterDate - The date to search after (default: now)
 * @returns The next occurrence Date, or null if no more occurrences
 */
export function getNextOccurrence(
  rruleString: string,
  afterDate: Date = new Date()
): Date | null {
  const rule = RRule.fromString(normalizeRRule(rruleString));
  return rule.after(afterDate, false);
}

// ---------------------------------------------------------------------------
// RRULE Builder
// ---------------------------------------------------------------------------

type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

interface BuildRRuleOptions {
  /** Days of the week (e.g., ['MO', 'TU', 'WE']) */
  byDay?: string[];
  /** Maximum number of occurrences */
  count?: number;
  /** End date for the recurrence */
  until?: Date;
}

/**
 * Build an RRULE string from simplified inputs for the workshop creation form.
 *
 * @param frequency - Simple frequency label
 * @param options - Optional constraints (byDay, count, until)
 * @returns RRULE parameter string (e.g., "FREQ=WEEKLY;BYDAY=MO,TU")
 */
export function buildRRuleString(
  frequency: RecurrenceFrequency,
  options?: BuildRRuleOptions
): string {
  const parts: string[] = [];

  // Map frequency
  switch (frequency) {
    case 'daily':
      parts.push('FREQ=DAILY');
      break;
    case 'weekly':
      parts.push('FREQ=WEEKLY');
      break;
    case 'biweekly':
      parts.push('FREQ=WEEKLY');
      parts.push('INTERVAL=2');
      break;
    case 'monthly':
      parts.push('FREQ=MONTHLY');
      break;
  }

  // Optional BYDAY
  if (options?.byDay && options.byDay.length > 0) {
    parts.push(`BYDAY=${options.byDay.join(',')}`);
  }

  // Optional COUNT
  if (options?.count != null) {
    parts.push(`COUNT=${options.count}`);
  }

  // Optional UNTIL
  if (options?.until) {
    parts.push(`UNTIL=${formatDateForRRule(options.until)}`);
  }

  return parts.join(';');
}

// ---------------------------------------------------------------------------
// Human-Readable Description
// ---------------------------------------------------------------------------

/**
 * Get a human-readable description of an RRULE pattern.
 * Uses rrule's built-in `.toText()` method.
 *
 * @param rruleString - RRULE parameters
 * @returns Description like "every week on Monday"
 */
export function describeRRule(rruleString: string): string {
  const rule = RRule.fromString(normalizeRRule(rruleString));
  return rule.toText();
}

// ---------------------------------------------------------------------------
// Timezone-Aware Instance Generation
// ---------------------------------------------------------------------------

/**
 * Generate recurring instances with a specific time-of-day in the host's timezone.
 *
 * RRULE generates date-only occurrences. This function applies the host's intended
 * time and timezone, then converts to UTC for database storage.
 *
 * This prevents DST-related time shifts: a workshop at "7pm Eastern" stays at
 * 7pm Eastern regardless of whether EST or EDT is in effect.
 *
 * @param rruleString - RRULE parameters
 * @param timeOfDay - Time in "HH:mm" or "HH:mm:ss" format (e.g., "19:00")
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @param startDate - Earliest date to generate from
 * @param horizonDays - How many days forward (default: 90)
 * @returns Array of UTC Date objects ready for database storage
 */
export function generateInstancesInTimezone(
  rruleString: string,
  timeOfDay: string,
  timezone: string,
  startDate: Date,
  horizonDays: number = 90
): Date[] {
  // Generate raw date occurrences from RRULE
  const instances = generateInstances(rruleString, startDate, horizonDays);

  // Parse the time-of-day components
  const timeParts = timeOfDay.split(':');
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  const seconds = timeParts[2] ? parseInt(timeParts[2], 10) : 0;

  // For each occurrence, set the time in the host's timezone and convert to UTC
  return instances.map((date) => {
    // Build a Date object representing the intended local time
    const localDate = new Date(date);
    localDate.setHours(hours, minutes, seconds, 0);

    // Convert from the host's timezone to UTC
    // fromZonedTime interprets the Date as being in the given timezone
    // and returns the equivalent UTC Date
    return fromZonedTime(localDate, timezone);
  });
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize an RRULE string by ensuring it has the "RRULE:" prefix
 * that the rrule library expects for `fromString()`.
 */
function normalizeRRule(rruleString: string): string {
  if (rruleString.startsWith('RRULE:')) {
    return rruleString;
  }
  return `RRULE:${rruleString}`;
}

/**
 * Format a Date to the RRULE UNTIL format: YYYYMMDDTHHMMSSZ
 */
function formatDateForRRule(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

// ---------------------------------------------------------------------------
// Frequency Mapping (for reference by consumers)
// ---------------------------------------------------------------------------

/** Map of simple frequency labels to rrule Frequency enum values */
export const FREQUENCY_MAP: Record<RecurrenceFrequency, Frequency> = {
  daily: Frequency.DAILY,
  weekly: Frequency.WEEKLY,
  biweekly: Frequency.WEEKLY,
  monthly: Frequency.MONTHLY,
} as const;
