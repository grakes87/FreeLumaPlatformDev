---
phase: 18-fix-both-mode-api-routes
plan: 02
subsystem: api
tags: [sequelize, mode-isolation, both-mode, feed, social, workshops, announcements]

# Dependency graph
requires:
  - phase: 17-both-mode
    provides: Both-mode user type (mode='both') and ViewModeContext frontend resolution

provides:
  - Both-mode users bypass mode isolation in feed, FYP, user search, follow suggestions
  - Both-mode users can follow users of any mode when mode_isolation_social is enabled
  - Both-mode users see workshops from both bible and positivity modes
  - Both-mode users see all mode-targeted announcements (all, bible, positivity)
affects:
  - any future phase that adds mode-filtered API routes

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Both-mode mode isolation bypass: `currentUser.mode !== 'both'` guard before pushing mode filter"
    - "Both-mode workshop expansion: `Op.in(['bible','positivity'])` for WHERE mode clause"
    - "Both-mode announcement expansion: `targetModes = ['all','bible','positivity']` for Both users"

key-files:
  created: []
  modified:
    - src/app/api/feed/route.ts
    - src/app/api/feed/fyp/route.ts
    - src/app/api/users/search/route.ts
    - src/app/api/follows/suggestions/route.ts
    - src/app/api/follows/[userId]/route.ts
    - src/app/api/workshops/route.ts
    - src/app/api/announcements/active/route.ts

key-decisions:
  - "Both-mode users bypass mode isolation entirely for social feeds (skip filter, not expand to Op.in) — they see all posts from all modes"
  - "Workshops use Op.in(['bible','positivity']) for Both users since workshops table never has mode='both'"
  - "Announcements expand targetModes to ['all','bible','positivity'] for Both users — no change to Op.in pattern, just wider array"

patterns-established:
  - "Guard pattern for mode isolation: `if (currentUser && currentUser.mode !== 'both')` before any mode-specific filter"
  - "Raw SQL mode filter: `const modeFilter = (modeIsolation === 'true' && currentUser.mode !== 'both') ? 'AND u.mode = :userMode' : ''`"
  - "Content list expansion: `const targetModes = userMode === 'both' ? ['all','bible','positivity'] : ['all', userMode]`"

requirements-completed: [FEED-01]

# Metrics
duration: 2min
completed: 2026-03-12
---

# Phase 18 Plan 02: Both-mode API Route Fixes Summary

**7 API routes fixed to exempt Both-mode users from mode isolation and expand content queries to cover both bible and positivity modes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T20:33:09Z
- **Completed:** 2026-03-12T20:35:16Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Fixed 5 social/feed routes so Both-mode users bypass `mode_isolation_social` filters entirely
- Fixed workshops route to use `Op.in(['bible','positivity'])` instead of `WHERE mode='both'` (which matched nothing)
- Fixed announcements route to expand `target_mode` filter to include both mode-specific announcement targets

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix mode isolation in feed, FYP, search, follows routes** - `51ded4a` (fix)
2. **Task 2: Fix workshops and announcements mode filtering for Both users** - `77d2d38` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/api/feed/route.ts` - Added `currentUser.mode !== 'both'` guard before mode isolation filter
- `src/app/api/feed/fyp/route.ts` - Added `currentUser.mode !== 'both'` guard in FYP candidate pool filter
- `src/app/api/users/search/route.ts` - Added `currentUser.mode !== 'both'` guard in user search filter
- `src/app/api/follows/suggestions/route.ts` - Skip raw SQL modeFilter clause for Both-mode users
- `src/app/api/follows/[userId]/route.ts` - Allow Both-mode users to follow users of any mode
- `src/app/api/workshops/route.ts` - Expand mode filter to `Op.in(['bible','positivity'])` for Both users
- `src/app/api/announcements/active/route.ts` - Expand targetModes array to `['all','bible','positivity']` for Both users

## Decisions Made
- **Skip vs expand for social feeds:** Both-mode users skip the mode filter entirely (no condition added to `andConditions`). This is correct because posts are always `'bible'` or `'positivity'` — omitting the filter effectively returns both modes. Using `Op.in` would also work but is unnecessary.
- **Workshops use Op.in:** Workshops always have mode `'bible'` or `'positivity'`. Expanding to `Op.in` is necessary since there is no way to "skip" the mode filter without also removing the single-mode filtering for non-Both users.
- **Announcements expand targetModes:** The `Op.in` was already used; only the array argument changes for Both users.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all 7 files matched the exact code patterns described in the plan. TypeScript passed with zero errors before and after all changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 18-02 complete. Remaining plan(s) in phase 18 can proceed.
- The Both-mode fix pattern is now established and documented: use `!== 'both'` guard for mode isolation bypasses, `Op.in(['bible','positivity'])` for content list expansions.
- No regressions to single-mode users — all changes are guarded by `mode === 'both'` checks.

---
*Phase: 18-fix-both-mode-api-routes*
*Completed: 2026-03-12*
