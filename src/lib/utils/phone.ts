import {
  isValidPhoneNumber,
  parsePhoneNumber,
  type CountryCode,
} from 'libphonenumber-js';

/**
 * Normalize a raw phone number string to E.164 format.
 * Returns the E.164 string (e.g., '+15551234567') or null if invalid.
 */
export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = 'US'
): string | null {
  try {
    if (!isValidPhoneNumber(raw, defaultCountry)) return null;
    const parsed = parsePhoneNumber(raw, defaultCountry);
    return parsed.format('E.164');
  } catch {
    return null;
  }
}

/**
 * Format an E.164 phone number for display in national format.
 * Returns national format (e.g., '(555) 123-4567') or the raw input on error.
 */
export function formatPhoneDisplay(e164: string): string {
  try {
    const parsed = parsePhoneNumber(e164);
    return parsed.formatNational();
  } catch {
    return e164;
  }
}

/**
 * Check if an E.164 phone number is a US or Canada number (country code +1).
 * Used to restrict SMS notifications to supported regions.
 */
export function isUSOrCanada(e164: string): boolean {
  return e164.startsWith('+1');
}
