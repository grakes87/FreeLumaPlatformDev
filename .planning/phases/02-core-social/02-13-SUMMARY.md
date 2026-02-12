---
phase: 02-core-social
plan: 13
subsystem: ui, api
tags: [bottom-nav, create-picker, post-composer, draft-auto-save, bookmarks, post-detail, mentions, media-upload]

# Dependency graph
requires:
  - phase: 02-08
    provides: Bookmark toggle API, RepostButton, ReportModal, BookmarkButton
  - phase: 02-09
    provides: Draft API and useDraft hook for auto-save
  - phase: 02-10
    provides: MediaCarousel reference for feed display
provides:
  - Updated BottomNav with center '+' create button and mode filtering
  - CreatePicker overlay for post type selection
  - PostComposer with multi-media upload, @mention search, draft auto-save
  - Post detail page with inline comment thread
  - Bookmarks page with filter tabs and infinite scroll
  - User posts API with cursor pagination and batch enrichment
affects: [02-10-feed-integration, 02-14-admin-dashboard, profile-tabs, feed-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split nav tabs with center action button pattern"
    - "Full-screen composer with createPortal and draft auto-save"
    - "Inline comment thread (not bottom sheet) for post detail page"
    - "Batch enrichment pattern for user posts API (reactions/comments/bookmarks)"

key-files:
  created:
    - src/components/layout/CreatePicker.tsx
    - src/components/feed/PostComposer.tsx
    - src/app/(app)/post/[id]/page.tsx
    - src/app/(app)/bookmarks/page.tsx
    - src/app/api/users/me/posts/route.ts
  modified:
    - src/components/layout/BottomNav.tsx

key-decisions:
  - "Split BottomNav into LEFT_TABS and RIGHT_TABS with center '+' button between them"
  - "Prayer wall tab marked bibleOnly (hidden for positivity mode users)"
  - "CreatePicker auto-defaults based on current route (prayer-wall -> prayer_request, else -> post)"
  - "'+' button navigates to /feed?compose=post or /prayer-wall?compose=prayer_request via query param"
  - "PostComposer uses createPortal for full-screen overlay rendering"
  - "Post detail page uses inline comment thread (not bottom sheet) for better deep-link UX"
  - "Bookmarks page uses pill-style filter tabs (All/Posts/Daily Content)"
  - "User posts API uses batch enrichment pattern for reaction/comment/bookmark counts"

patterns-established:
  - "Center action button pattern: elevated circular button in bottom nav for primary creation action"
  - "Route-based default selection: auto-select create type based on usePathname()"
  - "Inline comments for detail pages vs bottom sheet for feed cards"

# Metrics
duration: 10min
completed: 2026-02-12
---

# Phase 2 Plan 13: Create Flow, Post Composer, Post Detail, Bookmarks Summary

**Center '+' create button in bottom nav, full-screen PostComposer with media upload and draft auto-save, post detail page with inline comments, bookmarks page with filters, and user posts API with batch enrichment**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-12T20:26:28Z
- **Completed:** 2026-02-12T20:36:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Bottom nav updated with elevated center '+' button that opens CreatePicker overlay for Feed Post / Prayer Request selection
- Prayer wall tab now hidden for positivity mode users (bibleOnly flag)
- Full-screen PostComposer with multi-media upload (up to 10), @mention user search, #hashtag styling, visibility selector, character counter, and auto-save via useDraft hook
- Post detail page at /post/[id] with inline comment thread, fixed comment input, reply-to support, and media display
- Bookmarks page with All/Posts/Daily Content filter tabs, unbookmark action, infinite scroll, and empty state
- User posts API at /api/users/me/posts with cursor pagination, batch reaction/comment/bookmark enrichment

## Task Commits

Each task was committed atomically:

1. **Task 1: Update BottomNav with center '+' button and CreatePicker** - `b77dba9` (feat)
2. **Task 2: PostComposer, post detail, bookmarks, user posts API** - `91b7c71` (feat)

## Files Created/Modified
- `src/components/layout/BottomNav.tsx` - Updated with split LEFT/RIGHT tabs, center '+' button, CreatePicker integration
- `src/components/layout/CreatePicker.tsx` - Overlay picker with Feed Post and Prayer Request options
- `src/components/feed/PostComposer.tsx` - Full-screen composer with media upload, mentions, drafts
- `src/app/(app)/post/[id]/page.tsx` - Post detail page with inline comments
- `src/app/(app)/bookmarks/page.tsx` - Bookmarks page with filter tabs and infinite scroll
- `src/app/api/users/me/posts/route.ts` - User's own posts API with batch enrichment

## Decisions Made
- Split BottomNav tabs into LEFT_TABS (Daily, Prayer, Feed) and RIGHT_TABS (Studies, Animations, Profile) with center '+' button
- Prayer wall tab uses `bibleOnly: true` to hide for positivity mode users (prayer wall is bible-mode only per CONTEXT)
- CreatePicker determines default option based on `usePathname()` -- on /prayer-wall defaults to Prayer Request
- '+' button triggers navigation with query param (`?compose=post` or `?compose=prayer_request`) rather than opening composer directly, allowing feed/prayer-wall pages to own the composer lifecycle
- PostComposer renders via `createPortal` to escape layout constraints
- Post detail page uses inline comments (not bottom sheet) for better deep-link experience and SEO
- Bookmarks page uses pill-style filter tabs matching platform design language
- User posts API uses batch enrichment pattern (separate queries for reactions, comments, bookmarks) matching established feed API pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PostComposer ready for integration into feed page and prayer wall via `?compose=` query param
- Post detail page ready for deep-linking from post cards
- Bookmarks page ready for profile "Saved" tab navigation
- User posts API ready for profile "Posts" tab

---
*Phase: 02-core-social*
*Completed: 2026-02-12*
