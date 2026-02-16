/**
 * Text field category definitions for the per-field font system.
 * Each field maps to a CSS custom property that the FontLoader injects on :root.
 * The admin font picker (Plan 06) uses these definitions to build its UI.
 */

export interface FontField {
  /** Unique identifier, e.g., 'nav_labels' */
  key: string;
  /** Human-readable label, e.g., 'Navigation Labels' */
  label: string;
  /** CSS custom property name, e.g., '--font-nav-labels' */
  cssVar: string;
  /** Describes where this font is used in the app */
  description: string;
  /** Sample text for font preview */
  sampleText: string;
}

export interface FontSection {
  /** Section heading in admin UI */
  title: string;
  /** Fields grouped under this section */
  fields: FontField[];
}

// ── Section Definitions ─────────────────────────────────────────────

export const FONT_SECTIONS: FontSection[] = [
  {
    title: 'Navigation',
    fields: [
      {
        key: 'nav_labels',
        label: 'Navigation Labels',
        cssVar: '--font-nav-labels',
        description: 'Bottom nav tab labels, top bar title',
        sampleText: 'Feed Prayer Watch Profile',
      },
    ],
  },
  {
    title: 'Headings',
    fields: [
      {
        key: 'page_titles',
        label: 'Page Titles',
        cssVar: '--font-page-titles',
        description: 'Main page headings (h1)',
        sampleText: 'Prayer Wall',
      },
      {
        key: 'section_headers',
        label: 'Section Headers',
        cssVar: '--font-section-headers',
        description: 'Card section titles, group headers (h2/h3)',
        sampleText: 'Trending Today',
      },
    ],
  },
  {
    title: 'Feed',
    fields: [
      {
        key: 'feed_username',
        label: 'Feed Usernames',
        cssVar: '--font-feed-username',
        description: 'Usernames and display names on post cards',
        sampleText: '@freeluma',
      },
      {
        key: 'feed_body',
        label: 'Feed Post Body',
        cssVar: '--font-feed-body',
        description: 'Post text content in feed cards',
        sampleText: 'God is good all the time...',
      },
      {
        key: 'feed_meta',
        label: 'Feed Metadata',
        cssVar: '--font-feed-meta',
        description: 'Timestamps, reaction counts, comment counts',
        sampleText: '2h ago  12 likes  3 comments',
      },
    ],
  },
  {
    title: 'Daily Post',
    fields: [
      {
        key: 'daily_verse',
        label: 'Daily Verse/Quote',
        cssVar: '--font-daily-verse',
        description: 'Main verse or quote text on daily post',
        sampleText: 'For God so loved the world...',
      },
      {
        key: 'daily_reference',
        label: 'Daily Reference',
        cssVar: '--font-daily-reference',
        description: 'Bible chapter reference or attribution',
        sampleText: 'John 3:16 (NIV)',
      },
      {
        key: 'daily_subtitle',
        label: 'Daily Subtitles',
        cssVar: '--font-daily-subtitle',
        description: 'Audio/video subtitle overlay text',
        sampleText: 'The Lord is my shepherd',
      },
    ],
  },
  {
    title: 'Prayer Wall',
    fields: [
      {
        key: 'prayer_body',
        label: 'Prayer Request Body',
        cssVar: '--font-prayer-body',
        description: 'Prayer request text content',
        sampleText: 'Please pray for my family...',
      },
      {
        key: 'prayer_meta',
        label: 'Prayer Metadata',
        cssVar: '--font-prayer-meta',
        description: 'Prayer counts, supporter info',
        sampleText: '24 people praying',
      },
    ],
  },
  {
    title: 'Profile',
    fields: [
      {
        key: 'profile_name',
        label: 'Profile Display Name',
        cssVar: '--font-profile-name',
        description: 'User display name on profile page',
        sampleText: 'John Smith',
      },
      {
        key: 'profile_bio',
        label: 'Profile Bio',
        cssVar: '--font-profile-bio',
        description: 'User bio text',
        sampleText: 'Grateful for every blessing',
      },
      {
        key: 'profile_stats',
        label: 'Profile Stats',
        cssVar: '--font-profile-stats',
        description: 'Follower/following/post counts',
        sampleText: '42 Posts  128 Followers',
      },
    ],
  },
  {
    title: 'General',
    fields: [
      {
        key: 'body_default',
        label: 'Body Text Default',
        cssVar: '--font-body-default',
        description: 'General body text, fallback font',
        sampleText: 'Welcome to Free Luma',
      },
      {
        key: 'button_labels',
        label: 'Button Labels',
        cssVar: '--font-button-labels',
        description: 'Button text across the app',
        sampleText: 'Follow  Message  Share',
      },
    ],
  },
];

// ── Flat helpers ─────────────────────────────────────────────────────

/** All font fields flattened from sections, for iteration / lookups. */
export const FONT_FIELDS: FontField[] = FONT_SECTIONS.flatMap((s) => s.fields);

/** Default value for unconfigured fields -- inherit from system font stack. */
export const DEFAULT_FONT = 'inherit';

/**
 * Build a complete font config by merging partial admin overrides with defaults.
 * Keys are field keys (e.g., 'nav_labels'), values are Google Font family names.
 * Missing keys default to 'inherit'.
 */
export function buildFontConfig(
  overrides: Record<string, string>
): Record<string, string> {
  const config: Record<string, string> = {};
  for (const field of FONT_FIELDS) {
    const value = overrides[field.key];
    config[field.key] = value && value !== '' ? value : DEFAULT_FONT;
  }
  return config;
}
