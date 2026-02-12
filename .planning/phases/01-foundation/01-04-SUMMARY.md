---
phase: 01-foundation
plan: 04
subsystem: ui-shell
tags: [next-themes, dark-mode, auth-context, route-groups, bottom-nav, top-bar, app-shell, layout]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: "Next.js project scaffolding with Tailwind v4, globals.css theme variables"
  - phase: 01-foundation/01-03
    provides: "UI component library (LoadingSpinner, EmptyState, Toast, ErrorBoundary)"
provides:
  - "Root layout with ThemeProvider (next-themes) and ToastProvider"
  - "AuthContext with JWT cookie check via /api/auth/me"
  - "useAuth hook with provider guard"
  - "Three route groups: (public), (app), onboarding"
  - "TopBar with logo and notification bell (transparent mode)"
  - "BottomNav with 6 tabs (bible) / 5 tabs (positivity), icons only"
  - "AppShell composing TopBar + BottomNav with transparent overlay for daily post"
  - "Placeholder pages for all tab routes"
  - "Dark mode toggle (light/dark/system) on profile page"
  - "Global 404, error boundary, and loading pages"
affects: [01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12, 02-core-social, 03-content, 04-communication, 05-workshops, 06-polish]

# Tech tracking
tech-stack:
  added: [next-themes]
  patterns: [auth-context-pattern, route-group-separation, transparent-overlay-nav, useAuth-hook]

key-files:
  created:
    - src/context/AuthContext.tsx
    - src/hooks/useAuth.ts
    - src/app/(public)/layout.tsx
    - src/app/(app)/layout.tsx
    - src/app/onboarding/layout.tsx
    - src/app/not-found.tsx
    - src/app/error.tsx
    - src/app/loading.tsx
    - src/components/layout/TopBar.tsx
    - src/components/layout/BottomNav.tsx
    - src/app/(app)/page.tsx
    - src/app/(app)/prayer-wall/page.tsx
    - src/app/(app)/feed/page.tsx
    - src/app/(app)/bible-studies/page.tsx
    - src/app/(app)/animations/page.tsx
    - src/app/(app)/profile/page.tsx
  modified:
    - src/app/layout.tsx
    - src/components/layout/AppShell.tsx
    - tsconfig.json

key-decisions:
  - "AuthContext checks /api/auth/me on mount; handles 401 gracefully as unauthenticated"
  - "ToastProvider added to root layout (not per-route) for app-wide toast access"
  - "(app) layout wraps with AuthProvider and redirects unauthenticated to /login"
  - "Onboarding layout redirects completed-onboarding users to home"
  - "BottomNav conditionally hides Animations tab for positivity mode users"
  - "TopBar and BottomNav accept transparent prop for daily post video overlay"
  - "Profile page includes dark mode toggle with light/dark/system options"

patterns-established:
  - "Route group pattern: (public) for unauthenticated, (app) for authenticated, onboarding for post-signup"
  - "Auth-protected layout: AuthProvider wraps children, loading/redirect logic in nested component"
  - "Transparent nav overlay: TopBar and BottomNav accept transparent prop, AppShell detects daily post route"
  - "useAuth hook: all authenticated components use useAuth() to access user, loading, isAuthenticated"

# Metrics
duration: 5min
completed: 2026-02-12
---

# Phase 1 Plan 4: App Shell & Navigation Summary

**Root layout with ThemeProvider + ToastProvider, auth context with JWT check, three route groups (public/app/onboarding), bottom tab navigation (6 bible / 5 positivity), top bar, dark mode toggle, and all placeholder pages**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-12T06:12:25Z
- **Completed:** 2026-02-12T06:17:06Z
- **Tasks:** 2
- **Files created/modified:** 19

## Accomplishments

- Root layout updated with ThemeProvider (next-themes, data-theme attribute, system default) and ToastProvider for app-wide access
- AuthContext created with full lifecycle: mount check via /api/auth/me, login/logout/refreshUser methods, UserData type
- useAuth hook with provider guard for clear error messages
- Three route groups established: (public) for unauthenticated pages, (app) for authenticated app shell, onboarding for post-signup flow
- (app) layout: auth-protected with loading state, redirect to /login if unauthenticated, redirect to /onboarding/mode if onboarding incomplete
- Onboarding layout: auth-protected with step indicator (progress bar), redirect to home if onboarding complete
- TopBar: fixed header with "Free Luma" logo and notification bell icon, transparent mode for daily post
- BottomNav: fixed footer with 6 tabs (bible mode) / 5 tabs (positivity mode), icons only, active state highlighting
- AppShell: composes TopBar + BottomNav, detects daily post route for transparent overlay
- All 6 tab placeholder pages created with EmptyState component and appropriate icons
- Profile page includes working dark mode toggle (light/dark/system) via next-themes
- Global 404, error boundary, and loading pages created
- Build passes with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Root layout, providers, auth context, route group layouts** - `20f0160` (feat)
2. **Task 2: Bottom nav, top bar, app shell, placeholder pages, dark mode** - `92a3a46` (feat)

Note: Task 2 files were committed alongside 01-05 auth library files due to concurrent plan execution. All Task 2 code is correct and present in the repository.

## Files Created/Modified

- `src/app/layout.tsx` - Updated with ThemeProvider, ToastProvider, dark mode body classes
- `src/context/AuthContext.tsx` - Auth state management with JWT cookie check
- `src/hooks/useAuth.ts` - Hook for accessing auth context with provider guard
- `src/app/(public)/layout.tsx` - Minimal centered layout for unauthenticated pages
- `src/app/(app)/layout.tsx` - Auth-protected layout with AppShell
- `src/app/onboarding/layout.tsx` - Auth-protected layout with step indicator
- `src/app/not-found.tsx` - 404 page with link to home
- `src/app/error.tsx` - Error boundary UI with retry button
- `src/app/loading.tsx` - Full-page loading spinner
- `src/components/layout/TopBar.tsx` - Fixed top bar with logo and bell icon
- `src/components/layout/BottomNav.tsx` - Fixed bottom nav with mode-conditional tabs
- `src/components/layout/AppShell.tsx` - Composes TopBar + BottomNav around content
- `src/app/(app)/page.tsx` - Daily Post placeholder
- `src/app/(app)/prayer-wall/page.tsx` - Prayer Wall placeholder
- `src/app/(app)/feed/page.tsx` - Feed placeholder
- `src/app/(app)/bible-studies/page.tsx` - Bible Studies placeholder
- `src/app/(app)/animations/page.tsx` - Luma Animations placeholder
- `src/app/(app)/profile/page.tsx` - Profile page with dark mode toggle
- `tsconfig.json` - Added test-auth.mts to exclude list

## Decisions Made

- **ToastProvider in root layout:** Added to root layout (not per-route) so all routes have toast access. This fulfills the pending todo from 01-03.
- **Auth redirect strategy:** Used client-side redirect via useEffect + useRouter instead of server-side redirect, since auth state comes from client-side /api/auth/me fetch.
- **Onboarding step indicator:** Progress bar with colored segments rather than numbered circles, for cleaner mobile appearance.
- **BottomNav mode filtering:** Filters tabs based on user.mode from auth context; defaults to 'bible' if user is null.
- **Transparent overlay detection:** AppShell checks if pathname === '/' to enable transparent mode on TopBar and BottomNav for daily post video backgrounds.
- **Dark mode toggle location:** Placed on profile page (not top bar) per CONTEXT.md which specifies settings section includes appearance toggle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded test-auth.mts from TypeScript build**
- **Found during:** Task 2 build verification
- **Issue:** A test file (test-auth.mts) from prior uncommitted work was included in tsconfig via `**/*.mts` glob, causing TypeScript compilation error on import path with .ts extension
- **Fix:** Added "test-auth.mts" to tsconfig.json exclude array
- **Files modified:** tsconfig.json
- **Commit:** 92a3a46

## Issues Encountered

- **Concurrent execution overlap:** Task 2 files were committed in the same commit as plan 01-05 auth library files (92a3a46) due to concurrent plan execution. Code is correct; commit message references 01-05 but contains Task 2 files as well. No code integrity issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- App shell ready for all feature pages to be built inside
- Auth context ready for /api/auth/me endpoint (created in Plan 05)
- Route groups established for all subsequent page development
- Bottom nav will automatically show/hide Animations tab based on user mode
- Dark mode fully functional end-to-end for all future components
- ToastProvider now in root layout, available everywhere

---
*Phase: 01-foundation*
*Completed: 2026-02-12*
