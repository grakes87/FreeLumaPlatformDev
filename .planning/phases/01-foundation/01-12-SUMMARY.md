---
phase: 01-foundation
plan: 12
subsystem: api-admin
tags: [admin-endpoints, activation-codes, daily-content, entry-pages, nfc-bracelets, withAdmin, zod, sequelize]

# Dependency graph
requires:
  - phase: 01-foundation/01-02
    provides: "ActivationCode, DailyContent, DailyContentTranslation Sequelize models and associations"
  - phase: 01-foundation/01-04
    provides: "Public route group, auth context, withAuth middleware pattern"
provides:
  - "withAdmin middleware (withAuth + is_admin DB check)"
  - "POST /api/admin/activation-codes: bulk code generation (1-100 unique 12-char codes)"
  - "GET /api/admin/activation-codes: paginated list with usage stats"
  - "POST /api/admin/daily-content: schedule daily content with translations"
  - "PUT /api/admin/daily-content: update existing daily content"
  - "GET /api/admin/daily-content: paginated list with mode/date filters"
  - "/bible branded entry page with faith branding and NFC bracelet activation_code forwarding"
  - "/positivity branded entry page with positivity branding and activation_code forwarding"
affects: [02-core-social, 03-content, 06-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [withAdmin-middleware, admin-api-pattern, full-screen-entry-pages]

key-files:
  created:
    - src/app/api/admin/activation-codes/route.ts
    - src/app/api/admin/daily-content/route.ts
    - src/app/(public)/bible/page.tsx
    - src/app/(public)/positivity/page.tsx
  modified:
    - src/lib/auth/middleware.ts

key-decisions:
  - "withAdmin uses lazy import of User model to avoid circular dependency at module init"
  - "Activation code generation uses crypto.randomBytes with confusing-char-excluded alphabet (no O/0/I/l)"
  - "Entry pages use fixed inset-0 overlay to break out of public layout max-w-md container"
  - "Daily content PUT replaces all translations when translations array provided (full replace, not merge)"

patterns-established:
  - "withAdmin middleware pattern: wraps withAuth, does DB lookup for is_admin, returns 403 if not admin"
  - "Admin API Zod validation: safeParse + first error message extraction for user-friendly error responses"
  - "Full-screen entry page pattern: fixed inset-0 z-50 to overlay the public layout container"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 1 Plan 12: Admin Endpoints & Entry Pages Summary

**Admin bulk activation code generation and daily content scheduling endpoints with withAdmin middleware, plus /bible and /positivity branded NFC-bracelet entry pages**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T06:23:43Z
- **Completed:** 2026-02-12T06:27:39Z
- **Tasks:** 2/2
- **Files created/modified:** 5

## Accomplishments

- withAdmin middleware added to auth middleware module (withAuth + is_admin DB lookup, 403 on non-admin)
- Admin activation codes endpoint: POST generates 1-100 unique 12-char codes with mode_hint and expiry; GET returns paginated list with used/unused counts
- Admin daily content endpoint: POST creates scheduled content with optional translations (in transaction); PUT updates existing content; GET returns paginated list with mode/date filters
- /bible and /positivity full-screen branded landing pages with gradient backgrounds, inspirational quotes, activation_code forwarding to signup, and SEO metadata

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin endpoints (activation codes and daily content management)** - `0710cc7` (feat)
2. **Task 2: /bible and /positivity branded entry pages** - `5d277cb` (feat)

Note: Task 2 files were committed in commit 5d277cb alongside 01-08 files due to concurrent plan execution. All Task 2 code is correct and present in the repository.

## Files Created/Modified

- `src/lib/auth/middleware.ts` - Added withAdmin HOF that wraps withAuth and checks is_admin via DB lookup
- `src/app/api/admin/activation-codes/route.ts` - POST (bulk generate) and GET (paginated list with stats)
- `src/app/api/admin/daily-content/route.ts` - POST (create with translations), PUT (update), GET (paginated list with filters)
- `src/app/(public)/bible/page.tsx` - Faith-branded entry page with indigo/purple gradient, Jeremiah 29:11 verse, and activation_code forwarding
- `src/app/(public)/positivity/page.tsx` - Positivity-branded entry page with amber/orange gradient, motivational quote, and activation_code forwarding

## Decisions Made

- **withAdmin lazy import:** Used `await import('@/lib/db/models')` inside the handler to avoid circular dependency at module initialization time, since middleware.ts is imported by many route files.
- **Code generation alphabet:** Excluded O, 0, I, l from the character set to avoid visual confusion when codes are read from NFC bracelet URLs or printed materials. Uses `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (30 chars).
- **Full-screen entry pages:** Used `fixed inset-0 z-50` positioning so the entry pages render full-screen over the public layout's `max-w-md` container without modifying the shared public layout.
- **Translation replacement on PUT:** When the `translations` array is provided in a PUT request, all existing translations are deleted and replaced. This is simpler than a merge/upsert strategy and fits the admin workflow of editing complete content.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Concurrent commit overlap:** Task 2 files (bible/positivity pages) were committed as part of the concurrent 01-08 plan commit (5d277cb) instead of getting their own dedicated commit. The code content is correct and complete -- only the commit attribution is shared. No code integrity issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Admin can now bulk-generate activation codes via POST /api/admin/activation-codes
- Admin can schedule daily content via POST /api/admin/daily-content
- /bible and /positivity entry pages are live for NFC bracelet URLs
- All Phase 1 admin and entry page functionality is complete
- Non-admin users receive 403 on all admin endpoints

---
*Phase: 01-foundation*
*Completed: 2026-02-12*
