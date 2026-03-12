---
phase: 17-both-mode-url-driven-daily-content-without-mode-switching
plan: 01
subsystem: database, api, types
tags: [sequelize, migration, enum, typescript, zod, mode]

# Dependency graph
requires: []
provides:
  - "'both' as valid User.mode ENUM value in database"
  - "Updated Mode type union across TypeScript codebase"
  - "Settings API accepts 'both' for mode updates"
  - "ContentMode type and resolveContentMode() helper for concrete mode resolution"
affects:
  - 17-02 (ViewModeContext and URL-driven mode resolution)
  - 17-03 (Settings UI for Both mode selection)
  - 17-04 (Daily content toggle and feed switching)
  - 17-05 (Notification dual-send for Both users)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ContentMode type for entities that only accept bible/positivity"
    - "resolveContentMode() to safely convert user.mode (including 'both') to concrete mode"

key-files:
  created:
    - src/lib/db/migrations/125-add-both-to-user-mode-enum.cjs
  modified:
    - src/lib/db/models/User.ts
    - src/context/AuthContext.tsx
    - src/lib/utils/constants.ts
    - src/app/api/settings/route.ts
    - src/app/(app)/settings/page.tsx
    - src/app/api/posts/route.ts
    - src/app/api/reposts/route.ts
    - src/app/api/workshops/route.ts
    - src/app/api/workshops/series/route.ts
    - src/app/api/admin/workshops/route.ts
    - src/components/tutorial/TutorialProvider.tsx

key-decisions:
  - "Added ContentMode type ('bible'|'positivity') and resolveContentMode() helper to handle 'both' -> 'bible' default for entities that only accept concrete modes"
  - "Fixed cascading type errors in Post, Repost, Workshop, and Admin Workshop APIs using resolveContentMode() rather than leaving type errors for later plans"
  - "Added 'both' option to settings page MODE_CONFIG with Combine icon from lucide-react"

patterns-established:
  - "ContentMode: Use for entities (Post, Workshop, DailyContent) that belong to a single mode"
  - "resolveContentMode(): Call when assigning user.mode to a ContentMode field"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-03-12
---

# Phase 17 Plan 01: Add 'both' to User.mode ENUM Summary

**Database migration adding 'both' to users.mode ENUM, TypeScript type updates across User/AuthContext/constants/settings, and resolveContentMode() helper for downstream consumers**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-12T19:05:56Z
- **Completed:** 2026-03-12T19:11:39Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Migration 125 adds 'both' to users.mode ENUM('bible','positivity','both') with safe down migration
- All TypeScript mode types updated (User model, AuthContext, constants, settings API Zod schema)
- New ContentMode type and resolveContentMode() helper prevent 'both' from leaking into entities that only accept concrete modes
- Settings page UI ready to display 'both' option with Combine icon
- Zero TypeScript compilation errors after all changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and model type update** - `5982b2a` (feat)
2. **Task 2: Update TypeScript types and API validation** - `0e64a6d` (feat)

## Files Created/Modified
- `src/lib/db/migrations/125-add-both-to-user-mode-enum.cjs` - Migration to add 'both' to users.mode ENUM
- `src/lib/db/models/User.ts` - Updated mode type union and Sequelize ENUM definition
- `src/context/AuthContext.tsx` - Updated UserData.mode type
- `src/lib/utils/constants.ts` - Added 'both' to MODES, new ContentMode type and resolveContentMode()
- `src/app/api/settings/route.ts` - Updated Zod schema and userFields type
- `src/app/(app)/settings/page.tsx` - Added 'both' to Settings interface, MODE_CONFIG, handleModeSwitch
- `src/app/api/posts/route.ts` - Use resolveContentMode() for post creation
- `src/app/api/reposts/route.ts` - Use resolveContentMode() for repost creation
- `src/app/api/workshops/route.ts` - Use resolveContentMode() for workshop creation
- `src/app/api/workshops/series/route.ts` - Use resolveContentMode() for series creation
- `src/app/api/admin/workshops/route.ts` - Use resolveContentMode() for admin workshop creation
- `src/components/tutorial/TutorialProvider.tsx` - Updated userMode type to accept 'both'

## Decisions Made
- Added `ContentMode` type and `resolveContentMode()` helper in constants.ts to cleanly handle the fact that while User.mode can be 'both', entities like Post, Workshop, and DailyContent only accept 'bible' or 'positivity'. Both resolves to 'bible' by default (matching the Context doc: "Both mode always defaults to Bible").
- Fixed all cascading type errors immediately rather than deferring to later plans, since they blocked TypeScript compilation (Deviation Rule 3).
- Used Combine icon from lucide-react for the 'both' mode option in settings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed cascading TypeScript errors from User.mode type change**
- **Found during:** Task 2 (TypeScript type check)
- **Issue:** Changing User.mode to include 'both' caused type errors in 7 additional files where user.mode was assigned to entities (Post, Workshop, etc.) that only accept 'bible'|'positivity'
- **Fix:** Created ContentMode type and resolveContentMode() helper; applied to posts/route.ts, reposts/route.ts, workshops/route.ts, workshops/series/route.ts, admin/workshops/route.ts; updated settings page Settings interface, MODE_CONFIG, state types; updated TutorialProvider userMode type
- **Files modified:** 7 files beyond the 5 specified in the plan
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 0e64a6d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for TypeScript compilation. The resolveContentMode() pattern provides a clean, reusable approach for all future code that needs to handle 'both' mode users.

## Issues Encountered
None beyond the cascading type errors addressed above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 'both' mode is fully accepted at the database and type level
- Settings page UI shows the 'both' option (later plans will refine the UX)
- resolveContentMode() helper ready for use across the codebase
- Ready for Plan 17-02 (ViewModeContext and URL-driven mode resolution)

---
*Phase: 17-both-mode-url-driven-daily-content-without-mode-switching*
*Completed: 2026-03-12*
