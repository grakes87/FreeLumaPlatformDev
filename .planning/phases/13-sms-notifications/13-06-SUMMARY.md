---
phase: 13-sms-notifications
plan: 06
subsystem: notifications
tags: [sms, cron, analytics, daily-reminder]
completed: 2026-02-18
duration: 2 min
dependency-graph:
  requires: [13-03, 13-04]
  provides: [sms-daily-dispatch, sms-analytics]
  affects: [13-07]
tech-stack:
  patterns: [fire-and-forget-dispatch, raw-sql-analytics]
key-files:
  modified:
    - src/lib/email/queue.ts
    - src/app/api/admin/analytics/route.ts
decisions:
  - id: sms-dispatch-unconditional
    choice: "Call dispatchSMSNotification for every daily reminder user unconditionally"
    reason: "dispatchSMSNotification internally handles all guard checks (phone verified, SMS enabled, category toggle, quiet hours, rate limit)"
  - id: sms-cleanup-parallel
    choice: "Run SmsLog cleanup in parallel with Notification and EmailLog cleanup"
    reason: "All three are independent destroys; parallel execution is faster"
metrics:
  tasks: 2/2
  commits: 2
---

# Phase 13 Plan 06: Daily Reminder SMS Dispatch & Admin SMS Analytics Summary

SMS daily reminder dispatch integrated into existing email cron; admin analytics returns SMS delivery stats (summary, daily volume, type breakdown, opt-in counts) via parameterized raw SQL queries.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Add SMS dispatch to daily reminder processor | 0ff5c69 | SMS fire-and-forget block after email send; SmsLog cleanup in daily 3am cron |
| 2 | Add SMS delivery stats to admin analytics endpoint | 0624128 | 4 SMS stat queries: summary, dailyVolume, byType, optInStats |

## Implementation Details

### Task 1: SMS Dispatch in Daily Reminder

Added an SMS dispatch block inside the `processDailyReminders()` user loop, immediately after the email send. Uses dynamic import of `dispatchSMSNotification` from `@/lib/sms/queue`. The call is wrapped in its own try/catch so SMS failures never block the email loop.

Also extended `cleanupOldNotifications()` to destroy `sms_logs` older than 90 days in parallel with the existing `notifications` (30 days) and `email_logs` (90 days) cleanup. Updated the log message to include SMS count.

### Task 2: SMS Analytics in Admin Endpoint

Added 4 new SQL queries to `GET /api/admin/analytics`:

1. **SMS Summary** - COUNT totals with CASE WHEN for sent/delivered/failed breakdown
2. **SMS Daily Volume** - DATE-grouped counts for trend charting
3. **SMS By Type** - GROUP BY sms_type for category breakdown (daily_reminder, follow, etc.)
4. **SMS Opt-In Stats** - JOIN users + user_settings to count verified phones and SMS-enabled users

All queries use `:days` parameterized replacement matching the existing period parameter. Results returned under `sms` key in the response object.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles cleanly (`npx tsc --noEmit` passes)
- `processDailyReminders` dispatches SMS for each user after email send
- `cleanupOldNotifications` destroys old sms_logs alongside email_logs
- Admin analytics returns `sms.summary`, `sms.dailyVolume`, `sms.byType`, `sms.optInStats`

## Next Phase Readiness

Plan 13-07 (final plan) can proceed. All SMS infrastructure is in place: models, migrations, Twilio integration, templates, dispatch queue, OTP API, user settings UI, daily reminder dispatch, and admin analytics.
