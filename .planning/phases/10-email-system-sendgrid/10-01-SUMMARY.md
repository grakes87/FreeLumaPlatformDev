---
phase: 10-email-system-sendgrid
plan: 01
subsystem: email
tags: [sendgrid, email, notifications, migrations]
depends_on:
  requires: [09-platform-refinements]
  provides: [sendgrid-transport, email-notification-settings, extended-email-types]
  affects: [10-02, 10-03, 10-04, 10-05]
tech-stack:
  added: ["@sendgrid/mail@8.1.6"]
  removed: ["nodemailer", "@types/nodemailer"]
  patterns: ["SendGrid SDK transport", "dev email whitelist guard"]
key-files:
  created:
    - src/lib/db/migrations/076-add-email-notification-settings.cjs
    - src/lib/db/migrations/077-extend-email-log-types.cjs
  modified:
    - package.json
    - src/lib/email/index.ts
    - src/lib/email/templates.ts
    - src/lib/email/queue.ts
    - src/lib/db/models/UserSetting.ts
    - src/lib/db/models/EmailLog.ts
    - src/app/api/email/unsubscribe/route.ts
    - src/app/api/settings/route.ts
decisions:
  - id: sendgrid-from-address
    decision: "Hardcoded from address to hello@freeluma.com"
    reason: "Single verified sender identity for SendGrid domain authentication"
  - id: hardcoded-app-url
    decision: "Hardcoded APP_URL to https://freeluma.com in all email files"
    reason: "Email links must always point to production domain regardless of environment"
  - id: sendgrid-tracking-disabled
    decision: "Disabled both click tracking and open tracking at SendGrid level"
    reason: "App uses its own tracking pixel; prevents double-tracking and link wrapping"
metrics:
  duration: 4 min
  completed: 2026-02-17
---

# Phase 10 Plan 01: SendGrid Foundation & Schema Extension Summary

**One-liner:** Replaced Nodemailer SMTP with SendGrid API SDK, added 3 email notification preference columns and 8 new email_log types, updated unsubscribe and settings routes.

## What Was Done

### Task 1: Install SendGrid SDK, replace transport, add dev whitelist
- Installed `@sendgrid/mail@8.1.6`, removed `nodemailer` and `@types/nodemailer`
- Rewrote `sendEmail()` to use `sgMail.send()` with disabled click and open tracking
- Added dev whitelist guard: `EMAIL_DEV_WHITELIST` env var (comma-separated) prevents accidental emails to real users in non-production
- Hardcoded from address to `hello@freeluma.com` (removed `SMTP_FROM` env var)
- Hardcoded `APP_URL` to `https://freeluma.com` in all 3 email files (`index.ts`, `templates.ts`, `queue.ts`)
- Console fallback preserved when `SENDGRID_API_KEY` is not set
- Commit: `4f33b83`

### Task 2: DB migrations + model updates + unsubscribe route + settings API
- Migration 076: Added 3 boolean columns to `user_settings` (all default `true`):
  - `email_reaction_comment_notifications`
  - `email_workshop_notifications`
  - `email_new_video_notifications`
- Migration 077: Extended `email_logs.email_type` ENUM from 4 to 12 values:
  - New: `reaction_comment_batch`, `workshop_reminder`, `workshop_cancelled`, `workshop_invite`, `workshop_recording`, `workshop_updated`, `workshop_started`, `new_video`
- Updated `UserSetting` model with 3 new fields in interface, creation attributes, class declares, and init
- Updated `EmailLog` model with 12-value union type and ENUM
- Extended `sendNotificationEmail()` emailType parameter to accept all 12 types
- Added 3 new categories to unsubscribe route (`reaction_comment`, `workshop`, `new_video`) in both `CATEGORY_TO_SETTING` and `CATEGORY_LABELS`
- Added 3 new email preference fields to settings API schema, PUT conditional assignments, GET response, and PUT response
- Hardcoded `APP_URL` in unsubscribe route
- Commit: `df88689`

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Hardcoded APP_URL in unsubscribe route**
- **Found during:** Task 2
- **Issue:** The unsubscribe route had `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'` which would generate broken links in emails
- **Fix:** Hardcoded to `https://freeluma.com` consistent with the other email files
- **Files modified:** `src/app/api/email/unsubscribe/route.ts`

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Hardcoded `hello@freeluma.com` as from address | Single verified sender identity for SendGrid domain auth |
| 2 | Hardcoded `APP_URL = 'https://freeluma.com'` in all email files | Email links must always point to production domain |
| 3 | Disabled SendGrid click + open tracking | App has its own tracking pixel; prevents double-tracking and link wrapping |
| 4 | Dev whitelist returns null when `EMAIL_DEV_WHITELIST` not set | Backwards compatible: all emails go through in dev when no whitelist configured |

## Verification Results

- [x] `npm ls @sendgrid/mail` shows `@sendgrid/mail@8.1.6`
- [x] `npm ls nodemailer` shows empty (removed)
- [x] No references to `nodemailer` in `src/`
- [x] No references to `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM/EMAIL_FROM` in email files
- [x] Both migrations applied (`up`)
- [x] TypeScript compiles without errors in modified files
- [x] Settings API returns all 7 email preference booleans

## Next Phase Readiness

All subsequent Phase 10 plans can now:
- Use `sendEmail()` with SendGrid transport
- Log emails with the 8 new `email_type` values
- Check user preferences via the 3 new `user_settings` columns
- Generate unsubscribe links for all 7 categories
