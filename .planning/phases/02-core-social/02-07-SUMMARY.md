---
phase: 02-core-social
plan: 07
subsystem: prayer-wall
tags: [api, prayer-requests, hooks, transaction, bible-mode, anonymous, profanity, blocks, cursor-pagination]
depends_on:
  requires: ["02-02"]
  provides: ["prayer-wall-api", "prayer-wall-hooks"]
  affects: ["02-08", "02-09"]
tech-stack:
  added: []
  patterns: ["sequelize-transaction-toggle", "bible-mode-restriction", "anonymous-masking", "optimistic-pray-toggle"]
key-files:
  created:
    - src/app/api/prayer-requests/route.ts
    - src/app/api/prayer-requests/[id]/route.ts
    - src/app/api/prayer-requests/[id]/pray/route.ts
    - src/app/api/prayer-requests/[id]/supporters/route.ts
    - src/hooks/usePrayerWall.ts
    - src/hooks/usePrayerToggle.ts
  modified: []
decisions:
  - id: bible-mode-prayer-restriction
    decision: "Prayer wall returns 403 for positivity-mode users with clear message"
    reason: "Prayer wall is bible-mode only per CONTEXT; positivity users should see an informative error"
  - id: prayer-mode-hardcoded-bible
    decision: "Prayer request posts always created with mode='bible' regardless of user mode check"
    reason: "Prayer wall is bible-mode exclusive content; user mode is validated at API entry but post mode is always bible"
  - id: pray-toggle-transaction
    decision: "Pray toggle uses sequelize.transaction for atomic create/destroy + increment/decrement"
    reason: "Prevents pray_count from drifting out of sync with PrayerSupport rows under concurrent requests"
  - id: supporters-author-only
    decision: "Only prayer request author can view the list of people who prayed"
    reason: "Privacy: users who pray may not want their support visible to other community members"
metrics:
  duration: "3 min"
  completed: "2026-02-12"
---

# Phase 2 Plan 7: Prayer Wall System Summary

Complete prayer wall API and client hooks -- 4 API route files and 2 React hooks for prayer request CRUD, feed browsing with tabs, atomic pray toggling, and supporter viewing.

## What Was Built

### API Routes

**`/api/prayer-requests` (GET + POST)**
- GET: Prayer wall feed with tab support (others/my_requests/my_joined), status filter (all/active/answered), cursor pagination, block filtering, anonymous masking, and per-prayer `is_praying` boolean
- POST: Create prayer request (Post with type=prayer_request + PrayerRequest extension row), profanity check, media attachment support, bible-mode enforcement

**`/api/prayer-requests/[id]` (GET + PUT + DELETE)**
- GET: Prayer detail with anonymous masking, privacy/block checks, is_praying status
- PUT: Update body (with re-profanity check + edited flag), privacy, is_anonymous, or mark_answered action (sets status=answered, answered_at, optional testimony)
- DELETE: Soft delete (paranoid) with ownership or admin override

**`/api/prayer-requests/[id]/pray` (POST)**
- Single-tap toggle: creates or destroys PrayerSupport in a sequelize.transaction while atomically incrementing/decrementing pray_count
- Returns { action: 'added'|'removed', pray_count }

**`/api/prayer-requests/[id]/supporters` (GET)**
- Author-only endpoint: returns paginated list of users who prayed with cursor pagination
- Includes user profile data (id, username, display_name, avatar_url, avatar_color)

### Client Hooks

**`usePrayerWall()`** -- Feed state management
- Manages activeTab, statusFilter, prayers array, loading, refreshing, hasMore, cursor
- Auto-resets and fetches on tab/filter change
- Methods: fetchNextPage, refresh, removePrayer, updatePrayer, setActiveTab, setStatusFilter

**`usePrayerToggle(prayerRequestId, initialPraying, initialCount)`** -- Optimistic toggle
- Immediate UI update on tap (flip isPraying, adjust prayCount)
- Server sync with rollback on error
- Returns { isPraying, prayCount, loading, toggle }

## Key Patterns

1. **Bible-mode restriction**: All prayer endpoints check user.mode and return 403 for positivity users
2. **Anonymous masking**: When is_anonymous=true and viewer is not the author, author info replaced with { id:0, username:'anonymous', display_name:'Anonymous' }
3. **Atomic pray toggle**: sequelize.transaction wraps PrayerSupport create/destroy + pray_count increment/decrement
4. **Tab-based feed**: Three tabs with distinct queries -- others (public, not own), my_requests (own), my_joined (has PrayerSupport)
5. **Block filtering**: getBlockedUserIds excludes blocked users bidirectionally on feed and detail endpoints

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compiles clean (`npx tsc --noEmit` passes)
- All 4 API route files created with proper exports
- Both hooks created with proper 'use client' directive
- Bible-mode restriction enforced on all prayer endpoints
- Anonymous masking applied in feed and detail views
- Atomic pray toggle via sequelize.transaction
- Author-only supporters list with cursor pagination

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 912f12f | feat(02-07): create prayer request API routes (CRUD, feed, pray toggle, supporters) |
| 2 | 61da3a7 | feat(02-07): create usePrayerWall and usePrayerToggle hooks |
