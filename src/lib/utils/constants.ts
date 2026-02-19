export const TRANSLATIONS = ['KJV', 'NIV', 'NRSV', 'NAB'] as const;
export type Translation = typeof TRANSLATIONS[number];

export const MODES = ['bible', 'positivity'] as const;
export type Mode = typeof MODES[number];

export const LANGUAGES = ['en', 'es'] as const;
export type Language = typeof LANGUAGES[number];

export const LANGUAGE_OPTIONS: Array<{ code: Language; flag: string; label: string }> = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
];

export const AVATAR_COLORS = [
  '#62BEBA', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
] as const;

export const BIO_MAX_LENGTH = 150;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const PASSWORD_MIN_LENGTH = 8;

export const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

// ---- Timezones (US, Canada, UK) ----

export const TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Halifax', label: 'Atlantic Time (AT)' },
  { value: 'America/St_Johns', label: 'Newfoundland Time (NT)' },
  { value: 'America/Edmonton', label: 'Mountain Time - Canada' },
  { value: 'America/Winnipeg', label: 'Central Time - Canada' },
  { value: 'America/Vancouver', label: 'Pacific Time - Canada' },
  { value: 'Europe/London', label: 'United Kingdom (GMT/BST)' },
];

/** Valid timezone IANA identifiers for validation */
export const VALID_TIMEZONES = TIMEZONE_OPTIONS.map((tz) => tz.value);

/**
 * Map a browser-detected IANA timezone to the closest match in our list.
 * Falls back to America/New_York if no match found.
 */
export function matchBrowserTimezone(browserTz: string): string {
  // Direct match
  if (VALID_TIMEZONES.includes(browserTz)) return browserTz;

  // Common aliases / region mappings
  const aliases: Record<string, string> = {
    'US/Eastern': 'America/New_York',
    'US/Central': 'America/Chicago',
    'US/Mountain': 'America/Denver',
    'US/Pacific': 'America/Los_Angeles',
    'US/Alaska': 'America/Anchorage',
    'US/Hawaii': 'Pacific/Honolulu',
    'US/Arizona': 'America/Phoenix',
    'Canada/Atlantic': 'America/Halifax',
    'Canada/Newfoundland': 'America/St_Johns',
    'Canada/Eastern': 'America/New_York',
    'Canada/Central': 'America/Winnipeg',
    'Canada/Mountain': 'America/Edmonton',
    'Canada/Pacific': 'America/Vancouver',
    'GB': 'Europe/London',
    'Europe/Belfast': 'Europe/London',
    // US cities that map to our options
    'America/Detroit': 'America/New_York',
    'America/Indiana/Indianapolis': 'America/New_York',
    'America/Kentucky/Louisville': 'America/New_York',
    'America/Boise': 'America/Denver',
    'America/Juneau': 'America/Anchorage',
    'America/Sitka': 'America/Anchorage',
    'America/Nome': 'America/Anchorage',
    'America/Adak': 'Pacific/Honolulu',
    // Canadian cities
    'America/Toronto': 'America/New_York',
    'America/Montreal': 'America/New_York',
    'America/Regina': 'America/Chicago',
    'America/Whitehorse': 'America/Vancouver',
    'America/Yellowknife': 'America/Edmonton',
  };

  if (aliases[browserTz]) return aliases[browserTz];

  // Fallback
  return 'America/New_York';
}

// ---- Reactions ----

export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'pray'] as const;
export type ReactionType = typeof REACTION_TYPES[number];

export const REACTION_EMOJI_MAP: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  pray: '🙏',
};

export const REACTION_LABELS: Record<ReactionType, string> = {
  like: 'Like',
  love: 'Love',
  haha: 'Haha',
  wow: 'Wow',
  sad: 'Sad',
  pray: 'Pray',
};

// Filtered subsets for contexts where haha is inappropriate
export const PRAYER_REACTION_TYPES = REACTION_TYPES.filter(t => t !== 'haha');
export const DAILY_REACTION_TYPES = REACTION_TYPES.filter(t => t !== 'haha');

// ---- Comments ----

export const COMMENT_MAX_LENGTH = 1000;
export const POST_COMMENT_MAX_LENGTH = 2000;
