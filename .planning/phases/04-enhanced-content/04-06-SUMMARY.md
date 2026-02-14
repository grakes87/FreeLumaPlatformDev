---
phase: 04-enhanced-content
plan: 06
subsystem: auth
tags: [middleware, ban, moderation, account-lifecycle, cron, node-cron]

# Dependency graph
requires:
  - phase: 04-02
    provides: "Ban, ModerationLog, ActivityStreak models + users table status/role/deactivated_at/deletion_requested_at columns"
provides:
  - "withModerator middleware for moderator-gated API routes"
  - "Ban enforcement in withAuth (403 for banned users, auto-unban for expired)"
  - "Account deactivate/delete APIs with 30-day grace period"
  - "Login auto-reactivation for deactivated/pending_deletion users"
  - "Account cleanup cron job for permanent deletion after 30 days"
affects: ["04-08", "04-07", "05-admin-dashboard"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "handleAccountStatus() helper for OAuth login status checks"
    - "Account cleanup cron with globalThis dual-init guard (server.js + socket)"
    - "Content anonymization (user_id=0 sentinel) before hard delete"

key-files:
  created:
    - "src/app/api/account/deactivate/route.ts"
    - "src/app/api/account/delete/route.ts"
    - "src/lib/cron/accountCleanup.ts"
  modified:
    - "src/lib/auth/middleware.ts"
    - "src/app/api/auth/login/route.ts"
    - "src/app/api/auth/google/route.ts"
    - "src/app/api/auth/apple/route.ts"
    - "src/lib/email/templates.ts"
    - "src/lib/email/index.ts"
    - "src/lib/socket/index.ts"
    - "server.js"

key-decisions:
  - "Ban check adds DB query to every withAuth request — acceptable at expected scale"
  - "withOptionalAuth unchanged — no ban check for guest endpoints"
  - "handleAccountStatus() extracted as shared helper in Google/Apple OAuth routes"
  - "Sentinel user_id=0 for content anonymization on permanent account deletion"
  - "DailyReactions fully deleted (not anonymized) on account cleanup"
  - "Non-fatal email sending for deletion notification"

patterns-established:
  - "withModerator middleware: wraps withAuth + checks is_admin OR role=moderator"
  - "Account status check in login: deactivated/pending_deletion auto-reactivated"
  - "Cron dual-init: server.js setTimeout + socket setupNamespaces dynamic import"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 4 Plan 6: Ban Enforcement & Account Lifecycle Summary

**Ban enforcement in withAuth with auto-unban, withModerator middleware, account deactivate/delete APIs with 30-day grace period, login auto-reactivation, and cleanup cron**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T06:47:15Z
- **Completed:** 2026-02-14T06:51:56Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- withAuth now enforces ban status on every authenticated request with auto-unban for expired bans
- New withModerator middleware exports ModeratorContext with isAdmin flag for plan 04-08
- Account deactivate (instant, reversible) and delete (30-day grace, password-confirmed) APIs
- All login routes (email, Google, Apple) auto-reactivate deactivated/pending_deletion users
- Daily cron job permanently deletes expired accounts with content anonymization

## Task Commits

Each task was committed atomically:

1. **Task 1: Ban enforcement in withAuth + withModerator middleware** - `c8a2688` (feat)
2. **Task 2: Account deactivate + delete APIs** - `c567577` (feat)
3. **Task 3: Login auto-reactivation + deletion cleanup cron** - `9adcc2c` (feat)

## Files Created/Modified
- `src/lib/auth/middleware.ts` - Extended withAuth with ban/status check, added withModerator
- `src/app/api/account/deactivate/route.ts` - POST endpoint for instant account deactivation
- `src/app/api/account/delete/route.ts` - POST endpoint for 30-day deletion request with password
- `src/app/api/auth/login/route.ts` - Extended with status check and auto-reactivation
- `src/app/api/auth/google/route.ts` - Added handleAccountStatus for OAuth login
- `src/app/api/auth/apple/route.ts` - Added handleAccountStatus for OAuth login
- `src/lib/cron/accountCleanup.ts` - Daily cron: find expired pending_deletion, anonymize, hard delete
- `src/lib/email/templates.ts` - Added accountDeletionTemplate with login CTA
- `src/lib/email/index.ts` - Added sendAccountDeletionEmail export
- `src/lib/socket/index.ts` - Added account cleanup cron initialization in setupNamespaces
- `server.js` - Added __initAccountCleanup call in 5s setTimeout fallback

## Decisions Made
- Ban check adds lightweight DB query (User.findByPk on PK) to every withAuth call -- acceptable at expected scale, PK lookup is indexed and fast
- withOptionalAuth left unchanged (no ban check) for guest-accessible endpoints
- Content anonymization uses sentinel user_id=0 rather than deleting posts, preserving community content
- DailyReactions fully deleted (not anonymized) since reactions without user context are meaningless
- OAuth routes share handleAccountStatus() helper to avoid code duplication
- Non-fatal email sending for deletion notification -- change succeeds even if email fails

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- withModerator is exported and ready for plan 04-08 (moderation dashboard APIs)
- Account lifecycle APIs ready for frontend integration in later plans
- Cleanup cron will run automatically once server starts

---
*Phase: 04-enhanced-content*
*Completed: 2026-02-14*
