---
phase: 14-first-time-user-tutorial-walkthrough
plan: 02
subsystem: ui, tutorial, overlay
tags: [swiper, coach-marks, spotlight, portal, tutorial-flow]

# Dependency graph
requires:
  - phase: 14-first-time-user-tutorial-walkthrough
    plan: 01
    provides: has_seen_tutorial column, AuthContext field, /api/tutorial route
provides:
  - TutorialProvider context with state machine (idle/slideshow/coach-marks/done)
  - TutorialSlideshow 4-card Swiper carousel overlay
  - TutorialCoachMarks spotlight cutout overlay system
  - tutorialSteps.ts step definitions for slideshow and coach marks
affects: [14-03 integration into app layout and settings replay button]

# Tech tracking
tech-stack:
  added: []
  patterns: [box-shadow spotlight cutout, createPortal z-60 tutorial overlays, RAF polling for DOM targets, mode-filtered coach mark steps]

key-files:
  created:
    - src/components/tutorial/TutorialProvider.tsx
    - src/components/tutorial/TutorialSlideshow.tsx
    - src/components/tutorial/TutorialCoachMarks.tsx
    - src/components/tutorial/tutorialSteps.ts

key-decisions:
  - "Coach mark steps filtered by user mode in TutorialProvider, not in child component"
  - "RAF polling with 3s timeout for missing DOM targets, auto-skip on timeout"
  - "styled-jsx global for swipe-hint animation keyframes (same pattern as PhoneNumberSection)"
  - "createPortal to document.body at z-60 for both overlay types (above z-50 modals)"

patterns-established:
  - "Tutorial overlay: createPortal + z-[60] above all other UI"
  - "Coach mark spotlight: CSS box-shadow 0 0 0 9999px rgba(0,0,0,0.75) technique"
  - "DOM target polling: requestAnimationFrame loop with timeout and auto-advance"

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 14 Plan 02: Tutorial UI Components Summary

**TutorialProvider state machine, 4-card Swiper slideshow overlay, and box-shadow spotlight coach mark system with mode-specific content and DOM target polling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T20:25:37Z
- **Completed:** 2026-02-20T20:29:07Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Created TutorialProvider with idle/slideshow/coach-marks/done state machine, skip/advance/replay controls, and body scroll locking
- Created tutorialSteps.ts with 4 slideshow card definitions and 4 coach mark target definitions (bible-specific content fields)
- Built TutorialSlideshow with Swiper horizontal carousel, pagination dots, mode-specific descriptions, CSS-only illustrations per slide
- Built TutorialCoachMarks with box-shadow spotlight cutout, RAF polling for DOM targets, tooltip positioning, animated swipe-up hint, and window resize recalculation

## Task Commits

Each task was committed atomically:

1. **Task 1: TutorialProvider context and tutorialSteps config** - `ca0d957` (feat)
2. **Task 2: TutorialSlideshow and TutorialCoachMarks components** - `f1feda2` (feat)

## Files Created
- `src/components/tutorial/tutorialSteps.ts` - 4 slideshow steps + 4 coach mark steps with mode-specific content fields
- `src/components/tutorial/TutorialProvider.tsx` - Tutorial context provider with state machine, skip/advance/replay, mode filtering, body scroll lock
- `src/components/tutorial/TutorialSlideshow.tsx` - 4-card Swiper carousel overlay with CSS-only illustrations, mode-specific descriptions, pagination dots
- `src/components/tutorial/TutorialCoachMarks.tsx` - Box-shadow spotlight cutout overlay with RAF polling, tooltip positioning, swipe-up animation hint

## Decisions Made
- Coach mark steps filtered by user mode (bibleOnly flag) in TutorialProvider before passing to TutorialCoachMarks -- keeps child component simpler
- RAF polling with 3-second timeout for missing DOM targets, auto-advances to next step if element never appears
- Used styled-jsx global for swipe-hint animation keyframes (consistent with existing PhoneNumberSection pattern)
- Both overlay types render via createPortal to document.body at z-[60], above z-50 modals
- CSS-only slide illustrations (phone frames, mode cards, reaction circles, nav bar) avoid image dependencies

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 tutorial UI components ready for integration into app layout (plan 14-03)
- TutorialProvider needs to be wrapped around app content in (app)/layout.tsx
- data-tutorial attributes need to be added to target DOM elements (daily-card, verse-toggle, bottom-nav, reactions-area)
- Settings replay button needs to call useTutorial().replay()
- No blockers for plan 14-03

---
*Phase: 14-first-time-user-tutorial-walkthrough*
*Completed: 2026-02-20*
