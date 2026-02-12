---
phase: 02-core-social
plan: 10
subsystem: feed-ui
tags: [feed, postcard, tiktok, instagram, carousel, infinite-scroll, platform-settings, dual-mode]

# Dependency graph
requires:
  - phase: 02-04
    provides: Post reaction API, PostReactionBar, PostReactionPicker components
  - phase: 02-05
    provides: Post comments API, PostCommentSheet, PostCommentThread components
  - phase: 02-06
    provides: Feed API (following + FYP), useFeed hook, useInfiniteScroll hook
  - phase: 02-08
    provides: Bookmark toggle API, BookmarkButton, RepostButton, ReportModal components
provides:
  - PostCard with Instagram and TikTok display variants
  - PostFeed list component with infinite scroll and pull-to-refresh
  - MediaCarousel for multi-media posts
  - TextPostGradient for TikTok-mode text-only posts
  - PostContextMenu for post actions (bookmark, report, block, edit, delete)
  - FeedTabs (FYP / Following) with animated indicator
  - EmptyFeedState with follow suggestions
  - usePlatformSettings hook for admin-controlled feed style
  - Complete feed page at /feed
affects: [02-admin-dashboard, future-post-detail, future-notification-linking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual feed display mode (TikTok snap-scroll vs Instagram card scroll) controlled by admin setting"
    - "usePlatformSettings hook caches admin settings client-side"
    - "PostCard as unified wrapper delegating to variant components"
    - "MediaCarousel with IntersectionObserver for video autoplay"
    - "Deterministic gradient selection via postId modulo for text-only posts"
    - "Pull-to-refresh via touch gesture (80px threshold)"

key-files:
  created:
    - src/hooks/usePlatformSettings.ts
    - src/components/feed/PostCard.tsx
    - src/components/feed/PostCardInstagram.tsx
    - src/components/feed/PostCardTikTok.tsx
    - src/components/feed/PostFeed.tsx
    - src/components/feed/MediaCarousel.tsx
    - src/components/feed/TextPostGradient.tsx
    - src/components/feed/PostContextMenu.tsx
    - src/components/feed/FeedTabs.tsx
    - src/components/feed/EmptyFeedState.tsx
    - src/app/(app)/feed/page.tsx
  modified:
    - src/app/(app)/profile/[username]/page.tsx
    - src/app/(app)/profile/page.tsx

key-decisions:
  - "PostCard delegates to Instagram or TikTok variant based on feedStyle prop from usePlatformSettings"
  - "TextPostGradient uses deterministic gradient via postId % 10 to prevent re-render flicker"
  - "TikTok mode hides search bar for immersive full-screen experience"
  - "MediaCarousel uses CSS scroll-snap for native-feel horizontal swipe"
  - "PostContextMenu closes on outside click and escape key"
  - "EmptyFeedState fetches follow suggestions from /api/follows/suggestions"

patterns-established:
  - "Admin-controlled UI variants via usePlatformSettings hook"
  - "Feed style switching at page level, variants at component level"
  - "RichText rendering for @mentions (linked) and #hashtags (styled)"

# Metrics
duration: 12min
completed: 2026-02-12
---

# Phase 2 Plan 10: Feed Page UI Summary

**Dual-mode feed page with TikTok (full-screen snap) and Instagram (card scroll) display styles, PostCard variants with all interaction buttons, media carousel, and infinite scroll with pull-to-refresh.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-12T20:26:09Z
- **Completed:** 2026-02-12T20:38:31Z
- **Tasks:** 2
- **Files modified:** 13 (11 created, 2 modified)

## Accomplishments

- Built 9 feed components and 1 hook covering both TikTok and Instagram display modes
- PostCard with full interaction suite: reactions, comments, reposts, bookmarks, context menu
- MediaCarousel with horizontal snap-scroll, pagination dots, and IntersectionObserver video autoplay
- Feed page with FYP/Following tabs, user search bar, infinite scroll, and pull-to-refresh
- usePlatformSettings hook reads admin feed_style setting to drive UI mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PostCard variants, MediaCarousel, and supporting components** - `decebba` (feat)
2. **Task 2: Build feed page with PostFeed list, infinite scroll, and search bar** - `91b7c71` (feat, included in parallel 02-13 commit)

## Files Created/Modified

- `src/hooks/usePlatformSettings.ts` - Hook fetching admin platform settings, exposes feedStyle and modeIsolation
- `src/components/feed/PostCard.tsx` - Unified wrapper delegating to Instagram or TikTok variant
- `src/components/feed/PostCardInstagram.tsx` - Card-based layout with header, rich text, media, action bar
- `src/components/feed/PostCardTikTok.tsx` - Full-screen layout with vertical action stack and overlay text
- `src/components/feed/PostFeed.tsx` - Post list with infinite scroll, pull-to-refresh, dual display mode
- `src/components/feed/MediaCarousel.tsx` - Horizontal snap carousel with pagination dots and video autoplay
- `src/components/feed/TextPostGradient.tsx` - Deterministic gradient background for text-only TikTok posts
- `src/components/feed/PostContextMenu.tsx` - Dropdown menu with bookmark/report/block/edit/delete
- `src/components/feed/FeedTabs.tsx` - Sticky FYP/Following tabs with animated underline indicator
- `src/components/feed/EmptyFeedState.tsx` - Empty state with follow suggestions from API
- `src/app/(app)/feed/page.tsx` - Feed page replacing placeholder, integrates all hooks and components

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | PostCard as thin wrapper delegating to variants | Keeps common state management (reactions, bookmarks) centralized |
| 2 | Deterministic gradient via postId modulo | Prevents color change on re-render; consistent visual identity per post |
| 3 | Search bar hidden in TikTok mode | Full-screen immersive experience; consistent with TikTok UX |
| 4 | CSS scroll-snap for both carousel and TikTok feed | Native-feel scrolling without JavaScript overhead |
| 5 | Pull-to-refresh with 80px threshold | Standard mobile pull distance; visual rotation indicator before trigger |
| 6 | EmptyFeedState fetches /api/follows/suggestions | Reuses existing follow suggestions API from 02-03 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript unknown-type JSX expression errors in profile pages**
- **Found during:** Task 2 (build verification)
- **Issue:** `{author && (...)}` with `Record<string, unknown>` type caused TS2322 in Next.js Turbopack build
- **Fix:** Extracted author fields as typed `const authorName = String(author.display_name ?? '')` before JSX usage; changed `item.originalPost &&` to pre-computed boolean `hasRepost`
- **Files modified:** `src/app/(app)/profile/[username]/page.tsx`, `src/app/(app)/profile/page.tsx`
- **Verification:** `npm run build` passes cleanly
- **Committed in:** `91b7c71` (part of parallel commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type fix was necessary for build to pass. Pre-existing issue, no scope creep.

## Issues Encountered

- Turbopack build cache intermittently produced stale errors (lock files, missing manifests). Resolved by clearing `.next` directory and rebuilding.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Feed UI is fully wired to feed API (02-06), reactions (02-04), comments (02-05), and actions (02-08)
- Both display modes functional and switchable via admin platform settings
- Post composer can navigate to feed after creation
- Feed integrates with user search for discovery
- Ready for admin dashboard feed style toggle (future plan)

---
*Phase: 02-core-social*
*Completed: 2026-02-12*
