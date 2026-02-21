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
  bibleTitle?: string;
  bibleDescription?: string;
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
      'Use the tabs at the bottom to navigate between your daily content, community feed, workshops, video library, and profile. Tap the + button to create new posts.',
    bibleDescription:
      'Use the tabs at the bottom to navigate between your daily verse, prayer wall, community feed, workshops, video library, and profile. Tap the + button to create new posts or prayer requests.',
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
    id: 'bible-translation',
    target: '[data-tutorial="bible-translation"]',
    title: 'Bible Translations',
    description:
      'Tap to switch between Bible translations like KJV, NIV, AMP, and more. Read the daily verse in your preferred translation.',
    bibleOnly: true,
    position: 'bottom',
  },
  {
    id: 'reactions-area',
    target: '[data-tutorial="reactions-area"]',
    title: 'React, Comment & Share',
    description:
      'Tap the heart to react, the bubble to comment, and the share icon to send the daily content to friends. Your voice matters here.',
    position: 'top',
  },
  {
    id: 'tab-daily',
    target: '[data-tutorial="tab-daily"]',
    title: 'Daily Post',
    description:
      'Your home screen — come back every day for a fresh verse or quote with audio and video.',
    position: 'top',
  },
  {
    id: 'tab-prayer',
    target: '[data-tutorial="tab-prayer"]',
    title: 'Prayer Wall',
    description:
      'Share prayer requests, pray for others, and celebrate answered prayers together.',
    bibleOnly: true,
    position: 'top',
  },
  {
    id: 'tab-feed',
    target: '[data-tutorial="tab-feed"]',
    title: 'Community Feed',
    description:
      'See posts from people you follow, discover new content, and engage with the community.',
    position: 'top',
  },
  {
    id: 'tab-create',
    target: '[data-tutorial="tab-create"]',
    title: 'Create Content',
    description:
      'Tap the + button to share a post or schedule a workshop.',
    bibleDescription:
      'Tap the + button to share a post, create a prayer request, or schedule a Bible study.',
    position: 'top',
  },
  {
    id: 'tab-workshops',
    target: '[data-tutorial="tab-workshops"]',
    title: 'Workshops',
    description:
      'Join live video workshops hosted by the community, or start your own.',
    bibleTitle: 'Bible Studies',
    bibleDescription:
      'Join live Bible study sessions hosted by the community, or start your own.',
    position: 'top',
  },
  {
    id: 'tab-watch',
    target: '[data-tutorial="tab-watch"]',
    title: 'Watch',
    description:
      'Browse the video library with devotionals, teachings, and inspirational content.',
    position: 'top',
  },
  {
    id: 'tab-profile',
    target: '[data-tutorial="tab-profile"]',
    title: 'Your Profile',
    description:
      'View your posts, followers, saved content, and account settings.',
    position: 'top',
  },
];
