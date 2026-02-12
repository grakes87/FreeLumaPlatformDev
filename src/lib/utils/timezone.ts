import { formatInTimeZone } from 'date-fns-tz';

/**
 * Returns today's date (YYYY-MM-DD) in the user's timezone.
 * Uses date-fns-tz to convert current UTC time to the user's local date.
 *
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Date string in YYYY-MM-DD format
 */
export function getUserLocalDate(timezone: string): string {
  try {
    return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
  } catch {
    // Fallback to UTC if invalid timezone
    console.warn(`[timezone] Invalid timezone "${timezone}", falling back to UTC`);
    return formatInTimeZone(new Date(), 'UTC', 'yyyy-MM-dd');
  }
}

/**
 * Client-side timezone detection using the Intl API.
 * Returns the user's IANA timezone string.
 *
 * @returns IANA timezone string (e.g., "America/New_York")
 */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York';
  }
}

/**
 * Validates that a string is a valid YYYY-MM-DD date format.
 *
 * @param dateStr - The string to validate
 * @returns true if valid date format
 */
export function isValidDateString(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Checks if a given date string is in the future relative to the user's timezone.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timezone - IANA timezone string
 * @returns true if the date is in the future
 */
export function isFutureDate(dateStr: string, timezone: string): boolean {
  const today = getUserLocalDate(timezone);
  return dateStr > today;
}
