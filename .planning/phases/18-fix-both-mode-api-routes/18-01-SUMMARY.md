---
phase: 18-fix-both-mode-api-routes
plan: 01
subsystem: api
tags: [daily-content, both-mode, resolveContentMode, ViewModeContext, useDailyContent]

# Dependency graph
requires:
  - phase: 17-both-mode
    provides: Both-mode user architecture, ViewModeContext, effectiveMode pattern
provides:
  - Both-mode users no longer receive 404 on /api/daily-posts (resolveContentMode fix)
  - Both-mode users no longer receive 404 on /api/daily-posts/[date] (resolveContentMode fix)
  - API routes accept optional ?mode= query param for explicit mode override
  - useDailyContent hook passes effectiveMode to API for correct mode content delivery
  - SingleDayCarousel wired to pass effectiveMode from ViewModeContext to hook
affects: [daily content pages, /daily/[date] navigation, Both-mode user experience]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolveContentMode() for daily content mode resolution — maps 'both' -> 'bible' as safe default"
    - "Optional ?mode= query param pattern — frontend passes active view mode to backend for Both users"
    - "URL parsing before user block — parse query params early so they're available in conditional branches"

key-files:
  created: []
  modified:
    - src/app/api/daily-posts/route.ts
    - src/app/api/daily-posts/[date]/route.ts
    - src/hooks/useDailyContent.ts
    - src/components/daily/DailyPostCarousel.tsx

key-decisions:
  - "API routes validate ?mode= param strictly (only 'bible' or 'positivity' accepted, anything else falls through to resolveContentMode)"
  - "useDailyContent mode param is optional — existing callers (preview-feed page) are unaffected"
  - "Only SingleDayCarousel passes effectiveMode — FeedModeCarousel uses prefetched content already resolved to a concrete mode"
  - "resolveContentMode('both') returns 'bible' — Both users default to Bible unless frontend explicitly passes 'positivity'"

patterns-established:
  - "resolveContentMode pattern: Use for any API route that queries daily_content by mode — prevents WHERE mode='both' which matches nothing"
  - "Frontend mode pass-through: useDailyContent accepts mode param for Both-mode context awareness"

requirements-completed: [DAILY-01, DAILY-05]

# Metrics
duration: 2min
completed: 2026-03-12
---

# Phase 18 Plan 01: Fix Both-mode Daily Content API Routes Summary

**resolveContentMode() applied to daily-posts API routes eliminating Both-mode 404s, plus useDailyContent hook wired to pass effectiveMode for correct mode content delivery**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T20:33:16Z
- **Completed:** 2026-03-12T20:36:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed live production bug: Both-mode users no longer get 404 on `/api/daily-posts` and `/api/daily-posts/[date]`
- Added optional `?mode=` query parameter to both API routes, validated strictly (only 'bible' or 'positivity' accepted)
- Updated `useDailyContent` hook with optional `mode` parameter that appends `&mode=` to fetch URL
- Wired `SingleDayCarousel` to read `effectiveMode` from `ViewModeContext` and pass to `useDailyContent`
- Both-mode user in Positivity view navigating to `/daily/[date]` now sees Positivity content

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix daily-posts API routes with resolveContentMode + mode query param** - `51ded4a` (fix) — NOTE: This was already committed as part of an earlier 18-02 execution that bundled the daily-posts route fixes together.
2. **Task 2: Wire useDailyContent hook to pass effectiveMode from ViewModeContext** - `58238c7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/api/daily-posts/route.ts` - Added `resolveContentMode` import, moved URL parsing before user block, replaced `mode = user.mode` with modeParam validation + resolveContentMode fallback
- `src/app/api/daily-posts/[date]/route.ts` - Same pattern as above — modeParam + resolveContentMode for date-specific daily content
- `src/hooks/useDailyContent.ts` - Added optional `mode` param to signature, appends `&mode=` to fetch URL, added `mode` to fetchContent dependency array
- `src/components/daily/DailyPostCarousel.tsx` - Imported `useViewMode`, `SingleDayCarousel` reads `effectiveMode` and passes to `useDailyContent`

## Decisions Made
- Strict mode param validation in API routes: only `'bible'` or `'positivity'` are accepted; any other value falls through to `resolveContentMode(user.mode)`. This prevents injection of arbitrary mode values.
- `useDailyContent` mode param left optional so all existing call sites continue to work without changes.
- Only `SingleDayCarousel` (used for `/daily/[date]` navigation) receives `effectiveMode` — `FeedModeCarousel` uses prefetched content already resolved server-side.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

During execution, Task 1 API route changes were found to be already committed in `51ded4a` (a prior execution that had bundled the daily-posts fixes with social route fixes under the 18-02 label). Task 1 was verified correct in HEAD and Task 2 proceeded normally.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both-mode daily content 404 bug is fixed
- Both-mode users in Positivity view will see Positivity content on `/daily/[date]` pages
- Remaining Phase 18 plans (workshops, announcements, feed mode isolation latent bugs) can proceed independently

---
*Phase: 18-fix-both-mode-api-routes*
*Completed: 2026-03-12*
