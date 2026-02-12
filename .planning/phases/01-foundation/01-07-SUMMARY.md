---
phase: 01-foundation
plan: 07
subsystem: onboarding
tags: [onboarding-wizard, mode-selection, profile-setup, interests, follow-suggestions, username-check, categories-api, user-api]

# Dependency graph
requires:
  - phase: 01-foundation/01-06
    provides: "Login/signup pages, auth flow, AuthContext, useAuth hook"
  - phase: 01-foundation/01-04
    provides: "UI components (Button, Input, Card, Toast), onboarding layout with step indicator"
  - phase: 01-foundation/01-08
    provides: "AvatarUpload, AvatarCrop, InitialsAvatar components, B2 presigned URL upload"
  - phase: 01-foundation/01-02
    provides: "User, Category, UserCategory models with associations"
provides:
  - "4-step onboarding wizard: mode -> profile -> interests -> follow -> app home"
  - "POST /api/users: partial profile update with Zod validation, bulk category save"
  - "GET/PUT /api/users/[id]: public profile fetch, self-update only"
  - "GET /api/users/check-username: rate-limited case-insensitive availability check"
  - "GET /api/categories: public endpoint returning active categories by sort_order"
  - "ModeSelector, ProfileSetup, InterestPicker, FollowSuggestions reusable components"
affects: [01-10, 01-11, 02-core-social]

# Tech tracking
tech-stack:
  added: []
  patterns: [onboarding-wizard-flow, debounced-username-check, bulk-category-replace, mode-url-hint]

key-files:
  created:
    - src/app/api/users/route.ts
    - src/app/api/users/[id]/route.ts
    - src/app/api/users/check-username/route.ts
    - src/app/api/categories/route.ts
    - src/components/onboarding/ModeSelector.tsx
    - src/components/onboarding/ProfileSetup.tsx
    - src/components/onboarding/InterestPicker.tsx
    - src/components/onboarding/FollowSuggestions.tsx
    - src/app/onboarding/mode/page.tsx
    - src/app/onboarding/profile/page.tsx
    - src/app/onboarding/interests/page.tsx
    - src/app/onboarding/follow/page.tsx
  modified: []

key-decisions:
  - "Debounced username check (400ms) with visual status indicator (checking/available/taken)"
  - "Category bulk replace: destroy all UserCategory for user, then bulkCreate with new selections"
  - "Follow suggestions use placeholder accounts in Phase 1; actual follow persistence deferred to Phase 2"
  - "ModeSelector pre-selects from ?mode= URL query param (passed from signup entry path)"
  - "GET /api/categories is public (no auth required) for onboarding access"
  - "Username check rate limited to 10 per minute per IP to prevent enumeration"
  - "InterestPicker maps category icon names to Lucide components via ICON_MAP"

patterns-established:
  - "Onboarding step pattern: component saves to /api/users via POST, then router.push to next step"
  - "Bulk category replace via DELETE+bulkCreate in single /api/users POST"
  - "Debounced live validation with visual status indicator (idle/checking/available/taken/invalid)"
  - "Suspense boundary on mode page for useSearchParams compatibility"

# Metrics
duration: 5min
completed: 2026-02-12
---

# Phase 1 Plan 7: Onboarding Wizard Summary

**4-step guided onboarding with mode selection, profile setup (display name, @username with live availability, avatar, bio), interest category picker, and follow suggestions; backed by user profile API with Zod validation, username check, and categories endpoint**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-12T06:35:00Z
- **Completed:** 2026-02-12T06:40:00Z
- **Tasks:** 2/2
- **Files created:** 12
- **Files modified:** 0

## Accomplishments

- POST /api/users endpoint: authenticated profile update with Zod partial schema validation, username uniqueness check, onboarding_step='complete' sets onboarding_complete=true, bulk category save (delete existing + insert new UserCategory records)
- GET/PUT /api/users/[id] endpoint: GET returns public-safe profile fields (excludes password_hash, email), PUT restricted to own profile only (403 for others)
- GET /api/users/check-username endpoint: case-insensitive username check with rate limiting (10/min/IP), validates format before DB query, returns { available: boolean }
- GET /api/categories endpoint: public (no auth), returns active categories ordered by sort_order then name
- ModeSelector component: two large cards (Bible/Faith with BookOpen icon, Positivity with Sun icon), animated selection state with checkmark, pre-selects from ?mode= URL hint, saves via POST /api/users
- ProfileSetup component: react-hook-form with Zod resolver, display_name and username fields (@ prefix, live availability check with 400ms debounce showing check/X/spinner), bio textarea with 150-char counter, AvatarUpload integration (uses existing B2 presigned URL flow)
- InterestPicker component: fetches categories from /api/categories, renders as 2-column grid of toggleable chips with Lucide icons, minimum 1 required, saves via POST /api/users with categories array
- FollowSuggestions component: placeholder suggested accounts (Free Luma, Daily Verse, Positivity Daily) with follow toggle buttons, Continue and Skip for now buttons, completes onboarding by setting onboarding_step='complete', refreshes AuthContext
- All four onboarding page routes created under /onboarding/(mode|profile|interests|follow)
- Existing onboarding layout already handles auth guard, step indicator, and redirect logic
- Build passes with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: User profile API endpoints and username check** - `1d8ac49` (feat)
2. **Task 2: 4-step onboarding wizard UI** - `40dd75e` (feat)

## Files Created/Modified

- `src/app/api/users/route.ts` - POST profile update with Zod validation, category bulk save, onboarding completion
- `src/app/api/users/[id]/route.ts` - GET public profile, PUT self-update only
- `src/app/api/users/check-username/route.ts` - Rate-limited username availability check
- `src/app/api/categories/route.ts` - Public active categories endpoint
- `src/components/onboarding/ModeSelector.tsx` - Bible/Positivity card selection with URL hint pre-selection
- `src/components/onboarding/ProfileSetup.tsx` - Profile form with live username check, avatar upload, bio counter
- `src/components/onboarding/InterestPicker.tsx` - Category grid with toggle selection, Lucide icon mapping
- `src/components/onboarding/FollowSuggestions.tsx` - Placeholder follow suggestions, onboarding completion
- `src/app/onboarding/mode/page.tsx` - Mode selection page with Suspense boundary
- `src/app/onboarding/profile/page.tsx` - Profile setup page
- `src/app/onboarding/interests/page.tsx` - Interest selection page
- `src/app/onboarding/follow/page.tsx` - Follow suggestions page

## Decisions Made

- **Debounced username check:** 400ms debounce before API call, with visual indicator (spinner for checking, green check for available, red X for taken). Skips API call if username unchanged from current user's username.
- **Category bulk replace:** On save, deletes all existing UserCategory rows for the user and creates new ones. Simple and correct for onboarding where user is making initial selection.
- **Follow suggestions Phase 1 scope:** Three placeholder accounts shown but follow persistence is deferred to Phase 2 when the Follow model exists. The UI is functional with toggle state.
- **Mode URL hint:** ModeSelector reads ?mode= query param (e.g., from /bible or /positivity entry pages passing mode to signup). Uses Suspense boundary for useSearchParams.
- **Public categories endpoint:** GET /api/categories requires no auth since it's needed during onboarding before the user's profile is fully set up.
- **Username check rate limiting:** 10 requests per minute per IP address to prevent username enumeration attacks.
- **InterestPicker icon mapping:** Category icon field maps to Lucide component names via ICON_MAP object; defaults to Star icon for unmapped values.

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

- Full onboarding flow functional: signup -> mode -> profile -> interests -> follow -> app home
- User profile API endpoints ready for use by settings page (Plan 01-10) and profile card (01-08 already done)
- Categories endpoint available for any component needing category data
- Username check reusable for settings page username change
- Follow model and actual follow persistence needed in Phase 2

---
*Phase: 01-foundation*
*Completed: 2026-02-12*
