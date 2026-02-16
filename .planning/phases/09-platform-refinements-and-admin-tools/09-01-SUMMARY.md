---
phase: 09-platform-refinements-and-admin-tools
plan: 01
subsystem: ui-refinements
tags: [reactions, prayer, daily-content, profile, admin, thumbnails]
completed: 2026-02-16
duration: 4 min
dependency-graph:
  requires: [phase-02, phase-04]
  provides: [filtered-reaction-types, repost-view-badges, thumbnail-regen-all]
  affects: []
tech-stack:
  added: []
  patterns: [filtered-const-arrays, optional-prop-with-default]
key-files:
  created:
    - src/lib/db/migrations/071-remove-haha-from-prayer-daily.cjs
  modified:
    - src/lib/utils/constants.ts
    - src/components/daily/ReactionPicker.tsx
    - src/components/daily/QuickReactionPicker.tsx
    - src/components/daily/DailyPostSlide.tsx
    - src/components/prayer/PrayerCard.tsx
    - src/components/profile/ProfileGridItem.tsx
    - src/app/(admin)/admin/videos/page.tsx
decisions:
  - id: d-0901-1
    decision: "Add reactionTypes prop to QuickReactionPicker instead of hardcoding filtered list"
    reason: "QuickReactionPicker is shared by daily, prayer, and post feed components -- each needs different reaction sets"
metrics:
  tasks: 2/2
  commits: 1 (Task 2 changes committed by parallel agent)
---

# Phase 9 Plan 1: UX Refinements (Reactions, View Badges, Thumbnails) Summary

**Remove haha from prayer/daily pickers, add view badges to reposts, always-show thumbnail regen in admin**

## What Was Done

### Task 1: Remove haha reactions from prayer and daily content
- Created migration 071 that DELETEs existing haha reactions from `daily_reactions` and from `post_reactions` where the post is a prayer_request
- Added `PRAYER_REACTION_TYPES` and `DAILY_REACTION_TYPES` filtered arrays to `src/lib/utils/constants.ts` (both exclude 'haha')
- Updated `ReactionPicker` (daily-only component) to use `DAILY_REACTION_TYPES` directly
- Added optional `reactionTypes` prop to `QuickReactionPicker` with default of full `REACTION_TYPES` -- callers pass filtered subsets
- Updated `DailyPostSlide` to pass `DAILY_REACTION_TYPES` to QuickReactionPicker
- Updated `PrayerCard` to pass `PRAYER_REACTION_TYPES` to QuickReactionPicker
- Post feed components (PostCardTikTok, PostCardInstagram, post detail) continue using full REACTION_TYPES via default prop

### Task 2: View count badges on reposts + thumbnail regen for all videos
- Changed ProfileGridItem view count badge condition from `tab === 'posts' && isVideo` to `(tab === 'posts' || tab === 'reposts') && viewCount > 0`
- Removed `!video.thumbnail_url` wrapper from admin video thumbnail regeneration button
- Updated button title from "Retry thumbnail" to "Regenerate thumbnail"

## Decisions Made

| ID | Decision | Reason |
|----|----------|--------|
| d-0901-1 | Add reactionTypes prop to QuickReactionPicker instead of hardcoding filtered list | QuickReactionPicker is shared by daily, prayer, and post feed components -- each needs different reaction sets |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] QuickReactionPicker shared component needs prop instead of hardcoded filter**

- **Found during:** Task 1
- **Issue:** Plan said to change QuickReactionPicker to use DAILY_REACTION_TYPES, but this component is also used by post feed components (PostCardTikTok, PostCardInstagram, post detail page) which need all 6 reactions, and by PrayerCard which needs PRAYER_REACTION_TYPES
- **Fix:** Added optional `reactionTypes` prop defaulting to full REACTION_TYPES; callers pass their filtered subset
- **Files modified:** QuickReactionPicker.tsx, DailyPostSlide.tsx, PrayerCard.tsx
- **Commit:** 2f05ea3

**2. [Note] Task 2 changes committed by parallel agent**

- **Found during:** Task 2 commit
- **Issue:** Changes to ProfileGridItem.tsx and admin videos page were made in the working tree but then committed by a parallel 09-02 agent (f093af3) before this agent could commit them
- **Impact:** None -- changes are correctly in the repository, verified present in HEAD
- **Commit:** f093af3 (via 09-02 agent)

## Verification Results

- Migration 071 applied successfully (0.029s)
- `daily_reactions WHERE reaction_type = 'haha'`: 0 rows (confirmed)
- `post_reactions + prayer_request WHERE reaction_type = 'haha'`: 0 rows (confirmed)
- `post_reactions WHERE reaction_type = 'haha'`: 1 row remains (non-prayer post, correct)
- TypeScript: `npx tsc --noEmit` passes cleanly
- DAILY_REACTION_TYPES used in daily components (confirmed via grep)
- PRAYER_REACTION_TYPES used in prayer components (confirmed via grep)
- REACTION_TYPES (full) still used in PostReactionPicker (confirmed via grep)
- ProfileGridItem shows view count for reposts tab (confirmed via grep)
- Admin videos page shows regen button for all videos (confirmed, no thumbnail_url conditional)

## Next Phase Readiness

No blockers. All three refinements are self-contained and don't affect subsequent plans.
