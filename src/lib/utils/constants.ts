export const TRANSLATIONS = ['KJV', 'NIV', 'NRSV', 'NAB'] as const;
export type Translation = typeof TRANSLATIONS[number];

export const MODES = ['bible', 'positivity'] as const;
export type Mode = typeof MODES[number];

export const LANGUAGES = ['en', 'es'] as const;
export type Language = typeof LANGUAGES[number];

export const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
] as const;

export const BIO_MAX_LENGTH = 150;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const PASSWORD_MIN_LENGTH = 8;

export const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
