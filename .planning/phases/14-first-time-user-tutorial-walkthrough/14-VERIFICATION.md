---
phase: 14-first-time-user-tutorial-walkthrough
verified: 2026-02-20T20:37:48Z
status: gaps_found
score: 8/9 must-haves verified
gaps:
  - truth: "Existing users (imported from old platform) are not shown the tutorial"
    status: failed
    reason: "Migration 100 adds has_seen_tutorial with defaultValue: false for ALL existing rows. All ~31K imported users will trigger the tutorial on their next login because TutorialProvider starts when user.has_seen_tutorial === false."
    artifacts:
      - path: "src/lib/db/migrations/100-add-has-seen-tutorial-to-users.cjs"
        issue: "defaultValue: false is applied to every existing row in users table. Should be true for existing rows (or migration should run UPDATE users SET has_seen_tutorial = true WHERE created_at < migration_date)."
      - path: "src/components/tutorial/TutorialProvider.tsx"
        issue: "Line 78 — if (user.has_seen_tutorial) return; — guards correctly, but existing users have has_seen_tutorial = false so they all pass through."
    missing:
      - "Migration UPDATE: SET has_seen_tutorial = true for all rows existing at time of migration (e.g., use defaultValue: true in the migration, or add a bulk UPDATE after addColumn)"
      - "OR: Import script sets has_seen_tutorial = true for all users imported from the old platform (scripts/import-old-data.mjs)"
    note: "DESIGN CONFLICT: 14-CONTEXT.md line 43 explicitly states 'All imported users (31K) see tutorial on first login (since app is entirely new)' — the design intentionally contradicts ROADMAP success criterion #9. The implementation correctly follows the CONTEXT decision. This gap requires a product decision: update the ROADMAP criterion to match the design, or change the migration to skip existing users."
human_verification:
  - test: "Open app on a mobile viewport (375px) as a new user with has_seen_tutorial=false, complete onboarding"
    expected: "Slideshow appears after 1s with dark backdrop, all 4 slides render correctly, CSS illustrations visible, Skip button present on every slide"
    why_human: "Visual appearance and responsive layout cannot be verified programmatically"
  - test: "Swipe through all 4 slideshow cards (manually or via Next button), then observe coach marks phase"
    expected: "Coach marks appear sequentially on: daily-card, verse-toggle (bible mode), bottom-nav, reactions-area — each with spotlight cutout and tooltip"
    why_human: "DOM element targeting, spotlight positioning, and real-time layout verification require a running browser"
  - test: "Tap Skip on the first slideshow slide"
    expected: "Tutorial dismisses immediately, PUT /api/tutorial fires, user.has_seen_tutorial updates to true, tutorial does not re-appear on page reload"
    why_human: "Network call sequencing and persistence across page reload requires a live session"
  - test: "Go to Settings > Help > Replay Tutorial"
    expected: "Button triggers PUT /api/tutorial with reset:true, navigates to /, tutorial re-triggers after 1s delay"
    why_human: "Navigation + re-trigger sequencing requires a live session"
---

# Phase 14: First-Time User Tutorial & Walkthrough — Verification Report

**Phase Goal:** Guided onboarding tutorial for first-time logged-in users — after completing the existing onboarding flow (profile, interests, mode, follows), new users see a short welcome slideshow covering key app concepts followed by contextual coach marks on the main feed highlighting the daily feed swipe gesture, mode toggle, verse-by-category circle, bottom navigation, and social interaction patterns. Tutorial tracked via user flag so it only shows once.
**Verified:** 2026-02-20T20:37:48Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | First-time users see welcome slideshow (3-4 screens) after completing onboarding | VERIFIED | TutorialProvider.tsx:76-87 — auto-triggers slideshow after 1s when user.has_seen_tutorial=false; slideshowSteps.ts defines 4 cards |
| 2 | Slideshow covers: daily feed concept, bible/positivity modes, social features overview, how to navigate | VERIFIED | tutorialSteps.ts defines 4 slides: 'daily-feed', 'modes', 'social', 'navigation' with appropriate content and mode-specific descriptions |
| 3 | After slideshow dismissal, contextual coach marks highlight key UI elements on the main feed | VERIFIED | TutorialProvider.tsx:121-128 — advance() transitions slideshow→coach-marks phase; TutorialCoachMarks renders RAF-polled spotlight overlay |
| 4 | Coach marks cover: swipe gesture for daily feed, mode toggle, verse-by-category circle (bible mode), bottom nav tabs | VERIFIED | tutorialSteps.ts:66-100 — 4 coachMarkSteps: daily-card (swipe), verse-toggle (bibleOnly), bottom-nav, reactions-area; verse-toggle filtered by mode in TutorialProvider |
| 5 | User can skip/dismiss tutorial at any point | VERIFIED | TutorialSlideshow.tsx:214-220 — Skip button on slideshow; TutorialCoachMarks.tsx:217-223 — Skip button on coach marks; both call skip() → completeTutorial() |
| 6 | Tutorial completion tracked via user flag (has_seen_tutorial) — only shows once per account | VERIFIED | api/tutorial/route.ts PUT handler sets has_seen_tutorial=true; TutorialProvider.tsx:78 guards against re-showing when true; migration 100 adds column |
| 7 | Tutorial does not re-appear on subsequent logins or app visits | VERIFIED | TutorialProvider:78 — `if (user.has_seen_tutorial) return;` prevents re-trigger once PUT has been called; AuthContext refreshUser() is called after completion |
| 8 | Tutorial works correctly on mobile viewport sizes | HUMAN NEEDED | Code uses responsive classes (max-w-sm, fixed inset-0, mobile-first Tailwind); visual/touch behavior requires browser testing |
| 9 | Existing users (imported from old platform) are not shown the tutorial | FAILED | Migration 100 sets defaultValue:false for ALL rows. ~31K existing users get has_seen_tutorial=false and will trigger tutorial. NOTE: 14-CONTEXT.md intentionally chose this behavior ("All imported users see tutorial on first login") — design conflicts with ROADMAP criterion. |

**Score:** 8/9 truths verified (1 failed, 1 human-needed for mobile)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/migrations/100-add-has-seen-tutorial-to-users.cjs` | Migration adding has_seen_tutorial BOOLEAN column | VERIFIED | 16 lines, correct schema: BOOLEAN NOT NULL DEFAULT false, up/down both implemented |
| `src/app/api/tutorial/route.ts` | GET/PUT tutorial status API | VERIFIED | 46 lines, both handlers implemented with withAuth, User.findByPk (GET) and User.update (PUT), reset:true logic correct |
| `src/lib/db/models/User.ts` | has_seen_tutorial in all type interfaces | VERIFIED | Lines 39, 81, 127, 299 — present in UserAttributes, Optional list, class declaration, and User.init() |
| `src/context/AuthContext.tsx` | has_seen_tutorial: boolean on UserData interface | VERIFIED | Line 29 — field added to UserData interface; me route returns all non-excluded fields via toJSON() |
| `src/components/tutorial/TutorialProvider.tsx` | Context provider with state machine | VERIFIED | 193 lines — idle/slideshow/coach-marks/done state machine, auto-start logic, completeTutorial, skip, replay, body scroll lock, portal rendering |
| `src/components/tutorial/tutorialSteps.ts` | Step definitions for slideshow and coach marks | VERIFIED | 100 lines — 4 SlideshowStep objects + 4 CoachMarkStep objects with mode-specific content fields |
| `src/components/tutorial/TutorialSlideshow.tsx` | Swiper carousel overlay | VERIFIED | 224 lines — Swiper with Pagination+Keyboard modules, mode-specific descriptions, CSS illustrations per slide, Skip button |
| `src/components/tutorial/TutorialCoachMarks.tsx` | Spotlight coach mark overlay | VERIFIED | 254 lines — RAF polling with 3s timeout, box-shadow spotlight cutout, tooltip positioning for top/bottom/left/right, resize recalculation, swipe-hint animation keyframes |
| `src/components/daily/DailyPostSlide.tsx` | data-tutorial="daily-card" attribute | VERIFIED | Line 123 — attribute on root div |
| `src/components/daily/VerseModeToggle.tsx` | data-tutorial="verse-toggle" attribute | VERIFIED | Line 24 — attribute on root div |
| `src/components/layout/BottomNav.tsx` | data-tutorial="bottom-nav" attribute | VERIFIED | Line 151 — attribute on nav element |
| `src/components/daily/ReactionBar.tsx` | data-tutorial="reactions-area" attribute | VERIFIED | Line 29 — attribute on button element |
| `src/app/(app)/layout.tsx` | TutorialProvider wrapping AppShell | VERIFIED | Lines 16, 135-137 — TutorialProvider imported and wraps AppShell inside NotificationProvider (so useAuth() is available) |
| `src/app/(app)/settings/page.tsx` | Replay Tutorial button in Help section | VERIFIED | Lines 919-956 — Help section with RotateCcw icon, PUT /api/tutorial with reset:true, refreshUser(), router.push('/'), toast feedback |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TutorialProvider.tsx` | `/api/tutorial` | fetch PUT on tutorial complete | VERIFIED | Lines 106-111 — `fetch('/api/tutorial', { method: 'PUT', body: JSON.stringify({}) })` with credentials:include |
| `TutorialProvider.tsx` | `AuthContext` | `useAuth()` + `refreshUser()` | VERIFIED | Lines 45, 112 — useAuth() for user state, refreshUser() called after completion to sync has_seen_tutorial |
| `TutorialProvider.tsx` | `user.has_seen_tutorial` | conditional in useEffect | VERIFIED | Line 78 — `if (user.has_seen_tutorial) return;` prevents tutorial for returning users |
| `TutorialSlideshow.tsx` | `TutorialProvider` | `useTutorial()` | VERIFIED | Line 102 — destructures advance, skip, userMode, totalSteps from context |
| `TutorialCoachMarks.tsx` | DOM target elements | `document.querySelector(step.target)` via RAF | VERIFIED | Lines 36-50 — RAF polling with 3s timeout and auto-advance on not-found |
| `TutorialCoachMarks.tsx` | `[data-tutorial="daily-card"]` | CSS selector | VERIFIED | data-tutorial="daily-card" on DailyPostSlide.tsx:123 |
| `TutorialCoachMarks.tsx` | `[data-tutorial="verse-toggle"]` | CSS selector | VERIFIED | data-tutorial="verse-toggle" on VerseModeToggle.tsx:24 |
| `TutorialCoachMarks.tsx` | `[data-tutorial="bottom-nav"]` | CSS selector | VERIFIED | data-tutorial="bottom-nav" on BottomNav.tsx:151 |
| `TutorialCoachMarks.tsx` | `[data-tutorial="reactions-area"]` | CSS selector | VERIFIED | data-tutorial="reactions-area" on ReactionBar.tsx:29 |
| `api/tutorial/route.ts` | `users.has_seen_tutorial` | `User.update()` | VERIFIED | Lines 36-39 — `User.update({ has_seen_tutorial: value }, { where: { id: context.user.id } })` |
| `Settings page` | `/api/tutorial` (reset) | fetch PUT `{reset:true}` + refreshUser + router.push('/') | VERIFIED | Lines 926-938 — complete flow: PUT with reset:true, refreshUser(), navigate to home |
| `Migration 100` | `users` table | `queryInterface.addColumn` | VERIFIED | Correctly adds BOOLEAN NOT NULL DEFAULT false column |

---

## Requirements Coverage

No formal requirements mapped to Phase 14 in REQUIREMENTS.md (marked as "UX enhancement phase"). All success criteria verified directly from ROADMAP.md.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `TutorialSlideshow.tsx` | 98 | `return null` | Info | Legitimate — SlideIllustration returns null for unknown stepId (correct fallback) |
| `TutorialCoachMarks.tsx` | 189 | `return null` | Info | Legitimate — guard clause when step is undefined (correct boundary check) |

No blocker anti-patterns found. All "return null" occurrences are intentional guard clauses, not placeholder stubs.

---

## Human Verification Required

### 1. Mobile Layout and Visual Rendering

**Test:** Open the app on a 375px wide mobile viewport (iPhone SE size) logged in as a user with `has_seen_tutorial=false`. Wait 1 second after the home feed loads.
**Expected:** Slideshow modal appears with dark backdrop, card fills width correctly on mobile, illustration renders, Skip and Next buttons are accessible, pagination dots visible.
**Why human:** Visual appearance, touch swipe behavior, and responsive layout cannot be verified programmatically.

### 2. Slideshow-to-Coach-Marks Transition

**Test:** Swipe through or click Next through all 4 slideshow cards, then click "Get Started" on the last card.
**Expected:** Slideshow disappears, coach marks phase begins immediately — spotlight appears around the daily-card element, tooltip shows "Swipe Up" title, animated ChevronUp hint is visible.
**Why human:** DOM element targeting, spotlight positioning accuracy, and animation rendering require a running browser.

### 3. Skip Dismissal and Persistence

**Test:** Trigger tutorial, then click Skip on the first slideshow slide. Refresh the page.
**Expected:** Tutorial dismisses immediately. After refresh, tutorial does NOT re-appear (has_seen_tutorial is now true in the database).
**Why human:** Network call sequencing, database write confirmation, and cross-session persistence require a live session.

### 4. Settings Replay Flow

**Test:** Log in as a user with `has_seen_tutorial=true`. Navigate to Settings > Help > Replay Tutorial.
**Expected:** Toast "Tutorial will start on the home screen" appears, navigates to `/`, tutorial starts after 1s delay.
**Why human:** Multi-step navigation flow with toast feedback requires a live session.

### 5. Positivity Mode Coach Mark Filtering

**Test:** Log in as a user in positivity mode with `has_seen_tutorial=false`. Complete the slideshow and enter coach marks phase.
**Expected:** Verse-toggle coach mark step is SKIPPED (bibleOnly:true). Coach marks show: daily-card, bottom-nav, reactions-area (3 steps instead of 4).
**Why human:** Mode-specific filtering behavior requires a live session with a positivity-mode account.

---

## Gaps Summary

One gap blocks the literal interpretation of ROADMAP success criterion #9.

**Gap:** Migration 100 sets `has_seen_tutorial = false` for all rows in the `users` table, including the ~31K users imported from the old platform. The `TutorialProvider` triggers the tutorial for any user where `has_seen_tutorial === false`. Therefore, all existing imported users will see the tutorial on their first login after this migration runs.

**Design conflict note:** This gap reflects a documented design decision, not an oversight. `14-CONTEXT.md` (the design specification written before implementation) explicitly states: *"All imported users (31K) see tutorial on first login (since app is entirely new."* The ROADMAP success criterion #9 ("Existing users (imported from old platform) are not shown the tutorial") conflicts with this design decision. The code correctly implements the CONTEXT decision.

**Resolution options:**
1. Accept the design decision — update ROADMAP criterion #9 to reflect that imported users WILL see the tutorial (since the app platform is new to them)
2. Change the design — update migration to set `has_seen_tutorial = true` for all currently-existing rows, or update `scripts/import-old-data.mjs` to set `has_seen_tutorial = true` for all imported users

---

*Verified: 2026-02-20T20:37:48Z*
*Verifier: Claude (gsd-verifier)*
