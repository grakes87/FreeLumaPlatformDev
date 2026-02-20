export interface SlideshowStep {
  id: string;
  title: string;
  description: string;
  bibleDescription?: string;
  positivityDescription?: string;
  icon: string;
}

export interface CoachMarkStep {
  id: string;
  target: string;
  title: string;
  description: string;
  bibleOnly?: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Slideshow cards shown in the intro carousel overlay.
 * Bible-specific descriptions override the generic `description` when present.
 */
export const slideshowSteps: SlideshowStep[] = [
  {
    id: 'daily-feed',
    title: 'Your Daily Inspiration',
    description:
      'Every day, a fresh piece of content is waiting for you. Swipe left on the card to explore the audio reading and short video. Swipe up to see previous days.',
    bibleDescription:
      'Every day, a fresh verse and devotional is waiting for you. Swipe left on the card to explore the audio reading and short video. Swipe up to see previous days.',
    icon: 'Sparkles',
  },
  {
    id: 'modes',
    title: 'Choose Your Path',
    description:
      'FreeLuma offers two modes: Bible and Positivity. Switch anytime from your profile to explore the one that speaks to you most.',
    bibleDescription:
      'You are in Bible mode -- daily verses, audio devotionals, and a faith-centered community. You can switch to Positivity mode anytime from your profile.',
    positivityDescription:
      'You are in Positivity mode -- daily quotes, guided meditations, and an uplifting community. You can switch to Bible mode anytime from your profile.',
    icon: 'BookOpen',
  },
  {
    id: 'social',
    title: 'Connect & Share',
    description:
      'React to daily content, leave comments, and share with friends. This is a community built around encouragement.',
    bibleDescription:
      'React to daily content, leave comments, share with friends, and visit the Prayer Wall to support others in faith. This is a community built around encouragement.',
    icon: 'Heart',
  },
  {
    id: 'navigation',
    title: 'Explore FreeLuma',
    description:
      'Use the tabs at the bottom to navigate: Home for your feed, Search to discover posts, Create to share your own, Notifications for updates, and Profile for your settings.',
    icon: 'Navigation2',
  },
];

/**
 * Coach mark steps with DOM targets. Steps with bibleOnly: true
 * are filtered out for positivity-mode users by TutorialProvider.
 */
export const coachMarkSteps: CoachMarkStep[] = [
  {
    id: 'daily-card',
    target: '[data-tutorial="daily-card"]',
    title: 'Swipe Up',
    description:
      "Swipe up to see the next day's content. Each day brings something new to reflect on.",
    position: 'bottom',
  },
  {
    id: 'verse-toggle',
    target: '[data-tutorial="verse-toggle"]',
    title: 'Verse Mode',
    description:
      'Switch between the daily verse and verse-by-category to explore scripture at your own pace.',
    bibleOnly: true,
    position: 'bottom',
  },
  {
    id: 'bottom-nav',
    target: '[data-tutorial="bottom-nav"]',
    title: 'Navigation',
    description:
      'These five tabs are your guide: Home, Search, Create, Notifications, and Profile.',
    position: 'top',
  },
  {
    id: 'reactions-area',
    target: '[data-tutorial="reactions-area"]',
    title: 'React & Comment',
    description:
      'Tap to react or leave a comment on any daily content. Your voice matters here.',
    position: 'top',
  },
];
