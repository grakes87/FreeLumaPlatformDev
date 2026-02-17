---
phase: 11-verse-by-category-system
plan: 02
subsystem: api
tags: [next-api-routes, verse-categories, reactions, comments, sequelize]
dependency-graph:
  requires: [11-01]
  provides: [verse-category-api, verse-reactions-api, verse-comments-api]
  affects: [11-03, 11-04, 11-05]
tech-stack:
  added: []
  patterns: [withAuth-guard, withOptionalAuth, toggle-reaction, threaded-comments, sequelize-random]
key-files:
  created:
    - src/app/api/verse-categories/route.ts
    - src/app/api/verse-by-category/route.ts
    - src/app/api/verse-category-reactions/route.ts
    - src/app/api/verse-category-comments/route.ts
    - src/app/api/verse-category-comments/[id]/route.ts
  modified: []
decisions:
  - id: use-daily-view-activity-type
    choice: "Used 'daily_view' activity type instead of 'verse_category_view' (not in ActivityType union)"
    reason: "ActivityType enum only has 4 values; adding a new type would require modifying the streak tracker, which is out of scope for this plan"
  - id: bible-mode-gate
    choice: "403 for positivity-mode users on verse-by-category endpoint"
    reason: "Verse categories are Bible-only feature per requirements"
metrics:
  duration: 7 min
  completed: 2026-02-17
---

# Phase 11 Plan 02: User-Facing API Routes Summary

All 5 verse-by-category API route files created, mirroring daily-reactions and daily-comments patterns with verse-specific adaptations.

## Tasks Completed

### Task 1: Verse Categories List and Random Verse API Routes (d27dbd8)
- **GET /api/verse-categories**: Lists active categories ordered by sort_order, includes verse count per category via literal subquery, prepends virtual "All" entry with total count
- **GET /api/verse-by-category**: Returns random verse with translations, category info, background image, user reaction, reaction counts, and comment count
  - Bible-mode gate (403 for positivity users)
  - Exclusion support via `?exclude=id1,id2` (max 10 IDs) with automatic fallback when all excluded
  - Category filtering via `?category_id=N` or `?category_id=all`
  - Random background image selection (category-specific or global)
  - Fire-and-forget activity tracking

### Task 2: Verse Category Reactions and Comments API Routes (a75d6ca)
- **GET/POST /api/verse-category-reactions**: Toggle reactions (like/love/wow/sad/pray, no haha), get counts grouped by type with user's own reaction
- **GET/POST /api/verse-category-comments**: Paginated comments with user data and reply_count subquery, create comments with optional parent_id for threading
- **PUT/DELETE /api/verse-category-comments/[id]**: Edit (sets edited=true) and delete own comments with ownership check
- All endpoints mirror daily content patterns exactly
- Fire-and-forget activity tracking on reaction create and comment create

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used 'daily_view' instead of 'verse_category_view' activity type**
- **Found during:** Task 1
- **Issue:** Plan specified `verse_category_view` activity type but ActivityType union only allows `daily_view | audio_listen | video_watch | social_activity`
- **Fix:** Used `daily_view` for verse view tracking (closest match for content viewing activity) and `social_activity` for reaction/comment tracking
- **Files modified:** src/app/api/verse-by-category/route.ts
- **Commit:** d27dbd8

**2. [Rule 3 - Blocking] Type cast fix for Sequelize toJSON()**
- **Found during:** Task 1
- **Issue:** TypeScript error TS2352 when casting `verse.toJSON()` directly to `Record<string, unknown>` - needed intermediate `unknown` cast
- **Fix:** Used `verse.toJSON() as unknown as Record<string, unknown>`
- **Files modified:** src/app/api/verse-by-category/route.ts
- **Commit:** d27dbd8

## Verification Results

- All 5 API routes export correct HTTP methods (GET/POST/PUT/DELETE)
- TypeScript compilation passes (no new errors)
- `sequelize.random()` pattern confirmed in verse-by-category route (3 usages)
- Reaction toggle pattern confirmed (findOne/create/destroy)
- Bible-mode gate returns 403 for non-bible users
- Comment threading with reply_count subquery implemented
- Reaction types limited to like/love/wow/sad/pray (no haha)

## Next Phase Readiness

Plan 11-03 (client hooks) can now proceed -- all API endpoints are in place for:
- `useVerseCategories()` -> GET /api/verse-categories
- `useVerseByCategory()` -> GET /api/verse-by-category
- `useVerseCategoryReactions()` -> GET/POST /api/verse-category-reactions
- `useVerseCategoryComments()` -> GET/POST /api/verse-category-comments + PUT/DELETE /api/verse-category-comments/[id]
