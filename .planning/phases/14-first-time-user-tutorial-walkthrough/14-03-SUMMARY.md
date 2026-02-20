---
phase: 14-first-time-user-tutorial-walkthrough
plan: 03
subsystem: layout, settings, tutorial-integration
tags: [data-attributes, provider-wiring, replay-button, settings-page]

# Dependency graph
requires:
  - phase: 14-first-time-user-tutorial-walkthrough
    plan: 01
  - phase: 14-first-time-user-tutorial-walkthrough
    plan: 02
provides:
  - "End-to-end tutorial system wired into app"
  - "data-tutorial attributes on 4 target components"
  - "TutorialProvider in authenticated layout"
  - "Replay Tutorial button in Settings"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "data-tutorial attribute selectors for coach mark targeting"
    - "Context provider layering: NotificationProvider > TutorialProvider > AppShell"

# File tracking
key-files:
  modified:
    - src/components/daily/DailyPostSlide.tsx
    - src/components/daily/VerseModeToggle.tsx
    - src/components/layout/BottomNav.tsx
    - src/components/daily/ReactionBar.tsx
    - src/app/(app)/layout.tsx
    - src/app/(app)/settings/page.tsx

# Decisions
decisions:
  - id: tutorial-attr-placement
    description: "Placed data-tutorial attributes on outermost wrapper elements for reliable querySelector targeting by coach marks"

# Metrics
metrics:
  duration: "2 min"
  completed: "2026-02-20"
---

# Phase 14 Plan 03: Tutorial Integration & Wiring Summary

**One-liner:** Wired tutorial system into app with data-tutorial attributes on 4 components, TutorialProvider in authenticated layout, and Replay Tutorial in Settings.

## What Was Done

### Task 1: Add data-tutorial attributes and wire TutorialProvider into layout
- Added `data-tutorial="daily-card"` to `DailyPostSlide` root div
- Added `data-tutorial="verse-toggle"` to `VerseModeToggle` root div
- Added `data-tutorial="bottom-nav"` to `BottomNav` nav element
- Added `data-tutorial="reactions-area"` to `ReactionBar` button element
- Imported `TutorialProvider` in `(app)/layout.tsx`
- Wrapped `AppShell` with `TutorialProvider` inside `NotificationProvider` (so `useAuth()` is available to TutorialProvider)
- **Commit:** `6ad6c87`

### Task 2: Settings Replay button and build verification
- Added `RotateCcw` icon import to Settings page
- Added "Help" section with "Replay Tutorial" button before Danger Zone
- Button handler: calls `PUT /api/tutorial` with `{ reset: true }`, then `refreshUser()`, then `router.push('/')`
- Subtitle: "Watch the app introduction again"
- Verified `npx next build --webpack` compiles with zero errors
- **Commit:** `e6c4537`

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| tutorial-attr-placement | Placed data-tutorial on outermost wrapper elements | Coach mark querySelector needs stable, visible elements for spotlight positioning |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- 4 data-tutorial attributes confirmed across 4 component files
- TutorialProvider wraps AppShell in authenticated layout (inside NotificationProvider)
- Settings page has Replay Tutorial button in Help section
- Full Next.js build completes with zero errors
- Guest users do NOT see tutorial (TutorialProvider checks `user.has_seen_tutorial`, guests have no user)
- Tutorial auto-triggers for users with `has_seen_tutorial=false` (1s delay)

## End-to-End Tutorial Flow

1. New user logs in -> AuthContext loads `has_seen_tutorial: false`
2. TutorialProvider detects this, starts slideshow after 1s delay
3. User swipes through slideshow slides (5 steps)
4. Slideshow ends -> coach marks phase begins
5. Coach marks highlight `[data-tutorial="daily-card"]`, `[data-tutorial="verse-toggle"]`, `[data-tutorial="bottom-nav"]`, `[data-tutorial="reactions-area"]`
6. Last coach mark -> PUT /api/tutorial marks complete -> refreshUser()
7. Replay from Settings -> PUT /api/tutorial with reset:true -> refreshUser() -> navigate to / -> tutorial re-triggers
