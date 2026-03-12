---
phase: 17-both-mode-url-driven-daily-content-without-mode-switching
plan: 02
subsystem: ui
tags: [react-context, localStorage, view-mode, both-mode, state-management]

# Dependency graph
requires:
  - phase: 17-both-mode-url-driven-daily-content-without-mode-switching
    plan: 01
    provides: "'both' value in User.mode ENUM and TypeScript types"
provides:
  - "ViewModeContext providing effectiveMode ('bible'|'positivity') to component tree"
  - "useViewMode() hook for reading resolved mode"
  - "localStorage persistence of active view mode for Both users (fl_view_mode key)"
  - "Empty-content auto-switch back to Bible with toast for Both users"
  - "Scroll-to-top on mode change"
affects:
  - 17-04 (pill toggle on DailyPostSlide will use setViewMode from ViewModeContext)
  - 17-05 (notifications will use user.mode === 'both' for dual dispatch)
  - 17-06 (any remaining user.mode consumers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ViewModeContext pattern: resolves 'both' into 'bible' or 'positivity' for rendering"
    - "useViewMode() hook replaces direct user?.mode reads in consumer components"
    - "Default context values safe for guest rendering (no provider needed for guests)"

key-files:
  created:
    - src/context/ViewModeContext.tsx
  modified:
    - src/app/(app)/layout.tsx
    - src/components/layout/BottomNav.tsx
    - src/components/layout/TopBar.tsx
    - src/components/layout/CreatePicker.tsx
    - src/components/daily/DailyFeed.tsx
    - src/components/tutorial/TutorialProvider.tsx

key-decisions:
  - "ViewModeProvider wraps inside SocketProvider/NotificationProvider but outside TutorialProvider"
  - "Default context value (effectiveMode: 'bible') is safe for guest rendering in GuestDailyWrapper"
  - "DailyFeed uses ViewModeContext for authenticated users, mode prop fallback for guests"
  - "Auto-switch guard uses ref to prevent repeated firing on same mode"

patterns-established:
  - "ViewModeContext: central resolution of 'both' -> effective rendering mode"
  - "useViewMode() replaces user?.mode for all rendering decisions"
  - "resolvedMode pattern: user ? viewEffectiveMode : (mode prop || 'bible') for guest/auth split"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-12
---

# Phase 17 Plan 02: ViewModeContext and Consumer Components Summary

**React context resolving 'both' into effective rendering mode with localStorage persistence, empty-content auto-switch, and all 5 consumer components updated**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T19:14:23Z
- **Completed:** 2026-03-12T19:16:48Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created ViewModeContext that resolves 'both' user mode into 'bible' or 'positivity' for rendering
- Updated all 5 consumer components (BottomNav, TopBar, CreatePicker, DailyFeed, TutorialProvider) to use useViewMode()
- Added empty-content auto-switch back to Bible with info toast for Both users viewing a mode with no content
- Added scroll-to-top on mode change for Both-mode toggle

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ViewModeContext and integrate into app layout** - `c7b7c6a` (feat)
2. **Task 2: Update all consumer components to use useViewMode()** - `8418735` (feat)

## Files Created/Modified
- `src/context/ViewModeContext.tsx` - New context providing effectiveMode, isBothMode, setViewMode
- `src/app/(app)/layout.tsx` - Added ViewModeProvider wrapping TutorialProvider and AppShell
- `src/components/layout/BottomNav.tsx` - Uses effectiveMode for tab filtering, nav icons, workshop label
- `src/components/layout/TopBar.tsx` - Uses effectiveMode for verse mode toggle visibility
- `src/components/layout/CreatePicker.tsx` - Uses effectiveMode for workshop label
- `src/components/daily/DailyFeed.tsx` - Uses ViewModeContext for mode resolution, scroll reset, empty-content auto-switch
- `src/components/tutorial/TutorialProvider.tsx` - Uses effectiveMode for coach mark step filtering

## Decisions Made
- ViewModeProvider placed inside SocketProvider but outside TutorialProvider for correct dependency ordering
- Default context value (`effectiveMode: 'bible'`, `isBothMode: false`) is safe for components rendered outside the provider (e.g., TopBar in GuestDailyWrapper)
- DailyFeed uses dual resolution: ViewModeContext for authenticated users, `mode` prop fallback for guests
- Auto-switch guard uses a ref (`autoSwitchFiredRef`) that resets on mode change to prevent repeated firing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ViewModeContext is ready for the pill toggle component (plan 17-04) to call setViewMode
- All consumer components already respond to effectiveMode changes
- Both-mode users will see correct behavior once they toggle mode via the pill (or URL navigation)
- Notification dual dispatch (plan 17-05) can read user.mode === 'both' server-side

---
*Phase: 17-both-mode-url-driven-daily-content-without-mode-switching*
*Completed: 2026-03-12*
