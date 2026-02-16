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
