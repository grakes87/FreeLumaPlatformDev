---
phase: 21-investigate-fix-duplicate-email-notifications
plan: 02
subsystem: email
tags: [email, dedup, cron, concurrency, platform-settings, node-cron]

# Dependency graph
requires:
  - phase: 21-investigate-fix-duplicate-email-notifications
    plan: 01
    provides: content_mode column on email_logs, composite dedup index, module-level execution lock guards
  - phase: 10-email-sendgrid
    provides: Email queue system with EmailLog model, batch processors, and sendNotificationEmail
provides:
  - Both-mode daily reminder dedup using (recipient_id, content_mode) composite keys
  - 5-minute dedup windows on follow_request and prayer_response immediate emails
  - Database-level cron execution locking via PlatformSetting for all 8 cron jobs
  - cronLock.ts utility with acquireCronLock/releaseCronLock functions
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-level cron lock: acquireCronLock(jobName, maxAgeMs) with PlatformSetting timestamp and auto-expiry"
    - "Immediate email dedup: EmailLog.count with 5-minute sliding window before send"

key-files:
  created:
    - src/lib/email/cronLock.ts
  modified:
    - src/lib/email/queue.ts
    - src/lib/email/scheduler.ts
    - src/lib/workshop/reminders.ts

key-decisions:
  - "Both-mode dedup uses composite key (userId:contentMode) in Set instead of userId alone, allowing independent Bible/Positivity dedup"
  - "Immediate email dedup uses 5-minute sliding window on EmailLog.count - narrow enough to prevent double-click dups, wide enough to not block legitimate separate actions"
  - "DB-level cron locks use PlatformSetting with epoch timestamps and configurable maxAge for auto-expiry of stale locks"
  - "DB locks are ADDITIONAL layer on top of module-level boolean guards - defense-in-depth for cross-process safety"

patterns-established:
  - "Cron lock pattern: acquireCronLock before execution, releaseCronLock in finally block, with maxAge based on cron frequency"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 21 Plan 02: Fix Duplicate Email Notifications Summary

**Both-mode dedup with content_mode composite keys, 5-minute immediate email dedup windows, and DB-level cron execution locking across all 8 cron jobs**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T17:57:46Z
- **Completed:** 2026-03-16T18:02:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed both-mode daily reminder dedup to track (recipient_id, content_mode) composite keys, allowing Bible and Positivity emails to be independently deduplicated
- Added 5-minute dedup windows to processFollowRequestEmail and processPrayerResponseEmail preventing double-send on API retries
- Created cronLock.ts utility providing database-level cron execution locking via PlatformSetting
- Wrapped all 8 cron jobs (5 email + 3 workshop) with DB-level locks preventing overlapping execution across PM2 restarts

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix both-mode daily reminder dedup and add immediate email dedup** - `523d3f5` (fix)
2. **Task 2: Add database-level cron execution locking for cross-process safety** - `73040f6` (feat)

## Files Created/Modified
- `src/lib/email/cronLock.ts` - New utility with acquireCronLock/releaseCronLock using PlatformSetting timestamps
- `src/lib/email/queue.ts` - Fixed both-mode dedup with composite keys, added contentMode passthrough, added immediate email dedup
- `src/lib/email/scheduler.ts` - All 5 email cron jobs wrapped with DB-level locks
- `src/lib/workshop/reminders.ts` - All 3 workshop cron jobs wrapped with DB-level locks

## Decisions Made
- Both-mode dedup uses `userId:contentMode` composite key in the sentToday Set - old rows with NULL content_mode get key `userId:default` which won't match new keys
- Immediate email dedup checks `recipient_id + email_type + 5min window` (not actor_id, since EmailLog doesn't store it)
- Lock maxAge values tuned per job: 4min for 5-min crons, 14min for 15-min cron, 55min for hourly cron, 60min for daily crons
- Dynamic import for cronLock stays consistent with lazy-import pattern used throughout the codebase

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 identified duplicate email vectors from the research phase are now addressed
- Both-mode users will receive exactly 2 daily emails (Bible + Positivity) with independent dedup
- Immediate emails (follow, prayer) have 5-minute dedup windows
- All cron jobs have two layers of overlap protection (module-level boolean + DB-level PlatformSetting lock)
- No further plans in this phase

---
*Phase: 21-investigate-fix-duplicate-email-notifications*
*Completed: 2026-03-16*
