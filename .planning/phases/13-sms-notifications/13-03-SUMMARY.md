---
phase: 13-sms-notifications
plan: 03
subsystem: sms
tags: [sms, twilio, otp, webhook, templates, dispatch]
completed: 2026-02-18
duration: 3 min
dependency-graph:
  requires: ["13-01", "13-02"]
  provides: ["sms-templates", "sms-dispatch-queue", "otp-verification-api", "twilio-webhook"]
  affects: ["13-04", "13-05"]
tech-stack:
  added: []
  patterns: ["fire-and-forget dispatch", "guard chain pattern", "Twilio signature validation"]
key-files:
  created:
    - src/lib/sms/templates.ts
    - src/lib/sms/queue.ts
    - src/app/api/sms/verify/route.ts
    - src/app/api/sms/webhook/route.ts
  modified:
    - src/lib/email/queue.ts
decisions:
  - id: "sms-rate-limit-3"
    decision: "SMS rate limit set to 3/hour (vs email's 5/hour) due to SMS cost"
  - id: "sms-auto-enable"
    decision: "Auto-enable sms_notifications_enabled when phone is verified via OTP"
metrics:
  tasks-completed: 2
  tasks-total: 2
  commits: 2
---

# Phase 13 Plan 03: SMS Templates, Dispatch Queue, and OTP API Summary

SMS dispatch wiring layer with 6 templates under 160 chars, full guard chain dispatch, OTP phone verification API, and Twilio inbound webhook for STOP/START opt-out sync.

## Commits

| # | Hash | Description |
|---|------|-------------|
| 1 | 4df3d76 | feat(13-03): SMS templates, dispatch queue, and export isInQuietHours |
| 2 | b72fb00 | feat(13-03): OTP verification API and Twilio inbound webhook |

## Task Details

### Task 1: SMS templates, dispatch queue, isInQuietHours export

**SMS Templates (src/lib/sms/templates.ts):**
- 6 templates: follow, prayer, message, workshop_reminder, workshop_started, daily_reminder
- All under 160 characters (max: 85 chars for daily_reminder)
- Uses `freeluma.com` short URL with deep links for workshops and chat

**Dispatch Queue (src/lib/sms/queue.ts):**
- `dispatchSMSNotification()` with 7-step guard chain:
  1. Notification type is SMS-eligible (via SMS_CATEGORY_MAP)
  2. User has phone number set
  3. Phone is verified (phone_verified = true)
  4. Global SMS toggle enabled (sms_notifications_enabled)
  5. Per-category toggle enabled (mapped column)
  6. Not in quiet hours (reuses isInQuietHours from email/queue)
  7. Not rate limited (3 SMS/hour max)
- Creates SmsLog entry, sends via Twilio, updates status
- Fire-and-forget: never throws

**isInQuietHours export (src/lib/email/queue.ts):**
- Added `export` keyword to existing module-private function
- Now importable by SMS queue for quiet hours checking

### Task 2: OTP verification API and Twilio webhook

**POST /api/sms/verify (send OTP):**
- Protected with withAuth
- Validates phone with Zod, normalizes to E.164
- Rejects non-US/CA numbers with clear error message
- Sends OTP via Twilio Verify service
- Saves normalized phone to user record (phone_verified = false)

**PUT /api/sms/verify (check OTP):**
- Protected with withAuth
- Validates 6-digit code format
- Verifies phone matches user's stored phone (prevents switching)
- Checks OTP via Twilio Verify
- Sets phone_verified = true and auto-enables sms_notifications_enabled

**POST /api/sms/webhook (Twilio inbound):**
- No auth middleware (Twilio calls directly)
- Validates Twilio request signature (skips in dev when AUTH_TOKEN not set)
- Handles STOP: sets sms_notifications_enabled = false for matching user
- Handles START: sets sms_notifications_enabled = true for matching user
- Returns empty TwiML XML response (Content-Type: text/xml)

## Decisions Made

1. **SMS rate limit at 3/hour** - Lower than email's 5/hour due to SMS cost per message
2. **Auto-enable SMS on verification** - When user verifies phone via OTP, automatically enable sms_notifications_enabled to reduce friction

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Plan 04 (UI components for phone settings) can proceed. The API endpoints are ready:
- POST /api/sms/verify for sending OTP
- PUT /api/sms/verify for verifying OTP
- dispatchSMSNotification available for integration into notification flow
