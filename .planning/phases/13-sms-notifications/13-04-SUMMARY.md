---
phase: 13-sms-notifications
plan: 04
title: "Settings API + Notification Wiring"
subsystem: notifications
tags: [sms, settings-api, notification-dispatch, phone-verification]
depends_on:
  requires: ["13-01"]
  provides: ["Settings API with SMS toggle fields", "SMS dispatch in notification pipeline"]
  affects: ["13-05", "13-06", "13-07"]
tech_stack:
  added: []
  patterns: ["fire-and-forget SMS dispatch via dynamic import", "phone_verified server-side guard"]
key_files:
  modified:
    - src/app/api/settings/route.ts
    - src/lib/notifications/create.ts
decisions:
  - id: "sms-guard-pattern"
    description: "SMS toggles only settable when phone_verified is true (400 rejection)"
  - id: "sms-dispatch-position"
    description: "SMS dispatch runs after all email dispatch blocks, before return payload"
metrics:
  duration: "2 min"
  completed: "2026-02-18"
---

# Phase 13 Plan 04: Settings API + Notification Wiring Summary

Extended settings API with SMS fields and wired SMS dispatch into createNotification -- phone/phone_verified exposed in GET, 6 SMS toggles with phone_verified guard in PUT, fire-and-forget SMS dispatch after email blocks.

## Tasks Completed

### Task 1: Extend settings API with SMS toggle fields and phone display
**Commit:** `b632c7a`
**Files modified:** `src/app/api/settings/route.ts`

- Added 6 SMS boolean toggles to Zod validation schema (sms_notifications_enabled, sms_dm_notifications, sms_follow_notifications, sms_prayer_notifications, sms_daily_reminder, sms_workshop_notifications)
- GET handler now returns phone, phone_verified, and all 6 SMS toggle values alongside existing email toggles
- PUT handler accepts all 6 SMS fields with same pattern as email toggles
- Server-side guard: if any SMS toggle is being set to true, verifies user's phone_verified is true; returns 400 error otherwise
- PUT response includes all new fields with correct defaults (sms_notifications_enabled defaults false, per-category toggles default true)

### Task 2: Wire SMS dispatch into createNotification
**Commit:** `41ed2ae`
**Files modified:** `src/lib/notifications/create.ts`

- Added SMS dispatch block after all email dispatch blocks (workshop, follow, prayer)
- Uses dynamic import of `@/lib/sms/queue` matching existing email dispatch pattern
- Calls `dispatchSMSNotification(recipient_id, type, entity_type, entity_id, preview_text)` unconditionally
- Non-fatal: entire block wrapped in try/catch, logs error but never blocks notification creation
- dispatchSMSNotification (from Plan 03) handles all guard logic internally: phone exists, phone_verified, global toggle, per-category toggle, quiet hours, rate limit

## Verification Results

1. `npx tsc --noEmit` -- passes cleanly
2. GET /api/settings returns phone, phone_verified, and 6 SMS toggles -- confirmed in code
3. PUT /api/settings rejects SMS enable when phone not verified -- server-side guard in place
4. createNotification has SMS dispatch block after email blocks -- confirmed at lines 189-201

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| SMS guard checks all 6 toggles in a single array.some() | Efficient: one DB query for phone_verified only when at least one toggle is being enabled |
| SMS dispatch position: after all email blocks | Consistent ordering: Socket.IO -> email -> SMS in notification pipeline |
| Dynamic import for sms/queue | Matches email dispatch pattern; module may not exist yet (Plan 03 creates it) |

## Next Phase Readiness

- Plan 03 (SMS Templates, Queue, OTP API) creates `src/lib/sms/queue.ts` with `dispatchSMSNotification` -- the dynamic import in createNotification will resolve at runtime once Plan 03 executes
- Plan 05+ (Settings UI) can now read and write all SMS fields via the settings API
- No blockers identified
