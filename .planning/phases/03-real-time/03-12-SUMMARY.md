---
phase: "03-real-time"
plan: "12"
subsystem: "email-notifications"
tags: ["email", "node-cron", "nodemailer", "batching", "throttling", "tracking-pixel", "unsubscribe"]

dependency-graph:
  requires:
    - phase: "03-03"
      provides: "EmailLog model, UserSetting email preferences, Notification model"
    - phase: "03-06"
      provides: "createNotification() service, Socket.IO notifications namespace"
  provides:
    - "Branded HTML email templates (DM batch, follow request, prayer response, daily reminder)"
    - "Email open tracking via 1x1 pixel endpoint"
    - "One-click unsubscribe per category with purpose-scoped JWT"
    - "Email queue with rate limiting (5/hr), quiet hours, and batching"
    - "node-cron scheduler for DM batch (5min), daily reminders (hourly), cleanup (3AM)"
    - "processFollowRequestEmail() and processPrayerResponseEmail() for direct email triggers"
  affects: ["03-13 (integration wiring)", "admin-dashboard (email delivery metrics)"]

tech-stack:
  added: []
  patterns:
    - "notification-email-with-tracking-and-unsubscribe"
    - "cron-scheduler-via-globalThis-pattern"
    - "quiet-hours-timezone-aware-suppression"
    - "rate-limiting-via-email-log-count"

key-files:
  created:
    - src/lib/email/tracking.ts
    - src/lib/email/queue.ts
    - src/lib/email/scheduler.ts
    - src/app/api/email/track/route.ts
    - src/app/api/email/unsubscribe/route.ts
  modified:
    - src/lib/email/templates.ts
    - src/lib/email/index.ts
    - src/lib/socket/index.ts
    - server.js

key-decisions:
  - "Scheduler dual-init: socket namespace setup + server.js 5s setTimeout fallback"
  - "Unsubscribe JWT tokens expire in 90 days with purpose=email_unsubscribe"
  - "DM batch checks 24-hour window with 15-min delay and 30-min dedup"
  - "List-Unsubscribe + List-Unsubscribe-Post headers for RFC 8058 compliance"
  - "sendEmail() updated with optional headers parameter for custom mail headers"
  - "Tracking pixel uses fire-and-forget DB update to avoid blocking response"

patterns-established:
  - "Notification email pattern: generate trackingId + unsubscribeUrl, build template, send via sendNotificationEmail()"
  - "Quiet hours check using Intl.DateTimeFormat for timezone-aware time comparison"
  - "Rate limiting via EmailLog count query (sent+opened in last hour)"

duration: 5min
completed: 2026-02-13
---

# Phase 3 Plan 12: Email Notification System Summary

**Branded HTML email templates with DM batching, timezone-aware daily reminders, tracking pixels, one-click unsubscribe, rate limiting (5/hr), quiet hours, and node-cron scheduler integrated with server startup**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-13T17:36:20Z
- **Completed:** 2026-02-13T17:41:20Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Four branded HTML email templates: DM batch ("X unread from Y"), follow request, prayer response, daily reminder with verse text preview
- Email tracking pixel endpoint returns 1x1 transparent GIF, fire-and-forget DB update for opens
- One-click unsubscribe with purpose-scoped JWT per category (dm, follow, prayer, daily_reminder), renders HTML confirmation page
- Email queue with rate limiting (max 5 emails/hour/user), quiet hours suppression (timezone-aware), and DM batching (15-min delay, 30-min dedup)
- node-cron scheduler: DM batch every 5 minutes, daily reminders at top of each hour (timezone-matched), cleanup at 3 AM daily
- Scheduler initialized via Socket.IO namespace setup and server.js 5-second timeout fallback

## Task Commits

1. **Task 1: Email templates and tracking** - `6c79b1d` (feat)
2. **Task 2: Email queue, scheduler, and server integration** - `8301a4e` (feat)

## Files Created/Modified

- `src/lib/email/templates.ts` - Updated with 4 new notification email templates (dmBatch, followRequest, prayerResponse, dailyReminder) plus notification footer with tracking pixel and unsubscribe link
- `src/lib/email/tracking.ts` - UUID tracking ID generation, markSent/markBounced/markOpened helper functions
- `src/lib/email/queue.ts` - Email batching (DM batch), throttling (5/hr), quiet hours, direct email functions (follow/prayer), cleanup
- `src/lib/email/scheduler.ts` - node-cron initialization with globalThis guard for HMR safety
- `src/lib/email/index.ts` - sendEmail() updated to accept optional custom headers (List-Unsubscribe)
- `src/app/api/email/track/route.ts` - GET endpoint returns 1x1 GIF, records email opens via tracking_id
- `src/app/api/email/unsubscribe/route.ts` - GET endpoint verifies JWT, disables per-category email setting, renders HTML page
- `src/lib/socket/index.ts` - Added email scheduler initialization in setupNamespaces()
- `server.js` - Added 5-second timeout fallback to call globalThis.__initEmailScheduler()

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Scheduler dual-init (socket + server.js fallback) | Ensures cron jobs start even before first socket connection; server.js can't import TS directly |
| Unsubscribe JWT 90-day expiry | Long enough for old emails to remain actionable; purpose-scoped prevents abuse |
| DM batch 30-min dedup window | Prevents re-sending DM emails for same conversation within 30 minutes |
| Fire-and-forget tracking pixel | markOpened() runs async without blocking the 1x1 GIF response |
| List-Unsubscribe-Post header | RFC 8058 one-click unsubscribe support for Gmail/Yahoo inbox rendering |
| sendEmail headers parameter | Non-breaking addition -- existing callers unaffected, notification emails can pass List-Unsubscribe |

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required. Email uses existing SMTP configuration (or console fallback in dev).

## Next Phase Readiness

The email notification system is complete. Ready for:
- **03-13 (Integration):** Wire processFollowRequestEmail() and processPrayerResponseEmail() into createNotification() flow for follow_request and prayer notification types
- **Admin dashboard:** EmailLog data available for delivery metrics (sent/bounced/opened counts)
- DM batch processing uses existing Message and ConversationParticipant models
- Daily reminders use existing DailyContent model and UserSetting preferences

No blockers identified.

---
*Phase: 03-real-time*
*Completed: 2026-02-13*
