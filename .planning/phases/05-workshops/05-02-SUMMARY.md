---
phase: 05-workshops
plan: 02
subsystem: workshop-utilities
tags: [agora, cloud-recording, rrule, cron, reminders, recurrence]
depends_on:
  requires: [01-foundation, 03-real-time, 04-enhanced-content]
  provides: [agora-token-generation, cloud-recording-api, rrule-recurrence, workshop-cron-scheduler]
  affects: [05-03, 05-04, 05-05, 05-06]
tech_stack:
  added: []
  patterns: [agora-rtc-token-builder, cloud-recording-rest-lifecycle, rrule-recurrence, globalThis-cron-guard]
key_files:
  created:
    - src/lib/workshop/agora-token.ts
    - src/lib/workshop/cloud-recording.ts
    - src/lib/workshop/recurrence.ts
    - src/lib/workshop/reminders.ts
  modified:
    - src/lib/notifications/types.ts
decisions:
  - id: workshop-recording-uid-convention
    decision: "Recording UID = 900000 + workshopId to avoid collision with real user IDs"
    rationale: "Agora Cloud Recording joins as a user in the channel and needs a unique UID"
  - id: notification-types-extended
    decision: "Extended NotificationType and NotificationEntityType enums with workshop types"
    rationale: "Notification model already had workshop ENUMs but TypeScript types were missing"
  - id: rrule-normalization
    decision: "normalizeRRule() adds RRULE: prefix when missing for rrule library compatibility"
    rationale: "We store without prefix for simplicity; library expects prefix"
metrics:
  duration: 5 min
  completed: 2026-02-14
---

# Phase 5 Plan 02: Workshop Server-Side Utilities Summary

**Server-side workshop utility modules: Agora tokens, Cloud Recording, RRULE recurrence, and cron scheduler**

## What Was Built

### Task 1: Agora Token Generation and Cloud Recording Wrapper
- `generateAgoraToken(channelName, uid, role)` — generates time-limited RTC tokens with host (PUBLISHER) or audience (SUBSCRIBER) roles using the agora-token package
- `acquireRecordingResource()` — Step 1 of Cloud Recording lifecycle, returns resourceId (valid 5 min)
- `startCloudRecording()` — Step 2, starts composite-mode (mix) recording at 720p/30fps/1500kbps to B2 via S3-compatible API (vendor 11)
- `stopCloudRecording()` — Step 3, stops recording and returns HLS + MP4 file list
- `queryRecordingStatus()` — Queries recording state (0=not started through 5=abnormal exit)
- `getRecordingUid(workshopId)` — Returns 900000 + workshopId to avoid UID collision with real users

### Task 2: RRULE Recurrence Helpers
- `generateInstances(rruleString, startDate, horizonDays=90)` — generates Date array from RRULE within horizon window
- `getNextOccurrence(rruleString, afterDate=now)` — finds next occurrence after a given date
- `buildRRuleString(frequency, options?)` — builds RRULE from simplified form inputs (daily/weekly/biweekly/monthly + byDay/count/until)
- `describeRRule(rruleString)` — human-readable description via rrule's native toText()
- `generateInstancesInTimezone(rrule, timeOfDay, timezone, startDate, horizonDays)` — DST-safe instance generation: applies host's timezone then converts to UTC for storage

### Task 3: Workshop Cron Scheduler
- `initWorkshopCrons()` with globalThis HMR guard (matches email/scheduler.ts and cron/accountCleanup.ts patterns)
- **Cron 1 (every 5 min):** RSVP reminders at 1h and 15min before workshop start, deduped via group_key
- **Cron 2 (every 1 min):** No-show auto-cancel for workshops 15min past start, with transaction + row lock to prevent race conditions (pitfall 9)
- **Cron 3 (daily 4am UTC):** Series instance generation — rolling 90-day horizon, creates Workshop rows from WorkshopSeries RRULE patterns

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Recording UID = 900000 + workshopId | Avoids collision with real user IDs in Agora channel |
| Extended NotificationType/NotificationEntityType enums | Notification model already had workshop ENUMs; TypeScript types needed to match |
| RRULE normalizeRRule() adds prefix when missing | Stored without "RRULE:" prefix for clean DB storage; library expects it |
| Notifications sent after transaction commit | Non-fatal createNotification() calls outside transaction to avoid blocking cancel |
| Series instances filter existing + past dates | Prevents duplicate Workshop rows on repeated cron runs |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended NotificationType and NotificationEntityType enums**
- **Found during:** Task 3 (reminders.ts)
- **Issue:** The Notification model already had workshop ENUM values (workshop_reminder, workshop_cancelled, etc.) and 'workshop' entity type, but the TypeScript enum in `src/lib/notifications/types.ts` did not include them. This would cause type errors when creating workshop notifications.
- **Fix:** Added WORKSHOP_REMINDER, WORKSHOP_CANCELLED, WORKSHOP_INVITE, WORKSHOP_RECORDING, WORKSHOP_UPDATED, WORKSHOP_STARTED to NotificationType and WORKSHOP to NotificationEntityType.
- **Files modified:** `src/lib/notifications/types.ts`
- **Commit:** 01f8b99

## Commits

| Hash | Type | Description |
|------|------|-------------|
| a87abbe | feat | Agora token generation and Cloud Recording wrapper |
| 4b7957d | feat | RRULE recurrence helpers for workshop series |
| 01f8b99 | feat | Workshop cron scheduler with reminders, no-show, series generation |

## Next Phase Readiness

All 4 utility modules are ready for consumption by:
- Workshop API routes (Wave 2) — will import agora-token, cloud-recording, recurrence
- Socket.IO /workshop namespace (Wave 2) — will use agora-token for real-time token refresh
- Workshop creation form (Wave 3) — will use buildRRuleString, describeRRule
- Server startup (integration) — will call initWorkshopCrons()

No blockers identified.
