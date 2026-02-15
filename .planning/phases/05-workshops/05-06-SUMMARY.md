---
phase: 05-workshops
plan: 06
subsystem: api
tags: [agora, rtc, cloud-recording, websocket, workshop-lifecycle, webhook]

# Dependency graph
requires:
  - phase: 05-01
    provides: Workshop/WorkshopAttendee models with status columns and agora_channel field
  - phase: 05-02
    provides: Agora token generation and cloud recording wrapper utilities
  - phase: 05-05
    provides: Socket.IO /workshop namespace and workshop:state-changed event
provides:
  - POST /api/workshops/[id]/start — transitions scheduled/lobby to live with recording trigger
  - POST /api/workshops/[id]/end — transitions live to ended with recording stop
  - GET /api/workshops/[id]/token — role-based Agora RTC token generation
  - POST /api/workshops/recording-callback — Agora webhook that publishes recording to video library
affects: [05-08, 05-09, 05-10, 05-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Transaction with SELECT FOR UPDATE for race condition safety on status transitions"
    - "Fire-and-forget cloud recording with error isolation (recording failure does not block workshop start)"
    - "Webhook handler returning 200 on all paths to prevent retry loops"

key-files:
  created:
    - src/app/api/workshops/[id]/start/route.ts
    - src/app/api/workshops/[id]/end/route.ts
    - src/app/api/workshops/[id]/token/route.ts
    - src/app/api/workshops/recording-callback/route.ts
  modified: []

key-decisions:
  - "Cloud recording is fire-and-forget — failures are logged but don't block workshop start"
  - "Recording callback returns 200 on all paths including errors to prevent Agora retries"
  - "Token role mapping: host/co-host/speaker get PUBLISHER, attendees get SUBSCRIBER"
  - "Workshop category_id not mapped to video category_id in recording — set to null"

patterns-established:
  - "Workshop state machine enforcement: scheduled/lobby -> live -> ended"
  - "Race condition guard: DB transaction with row lock before status transition"
  - "Recording-to-video pipeline: webhook creates Video entry automatically"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 5 Plan 6: Workshop Lifecycle Endpoints Summary

**Workshop start/end/token/callback API endpoints with Agora Cloud Recording integration and transactional race condition safety**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T00:27:10Z
- **Completed:** 2026-02-15T00:31:10Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Workshop start endpoint with DB transaction (SELECT FOR UPDATE) to prevent race condition with no-show cron
- Automatic Cloud Recording trigger on start and stop on end (fire-and-forget with error isolation)
- Role-based Agora RTC token generation — host/co-host/speaker get PUBLISHER, attendees get SUBSCRIBER
- Recording webhook automatically creates Video entry in library and notifies all attendees

## Task Commits

Each task was committed atomically:

1. **Task 1: Workshop start and end lifecycle endpoints** - `e82937a` (feat)
2. **Task 2: Agora token endpoint and recording callback** - `82f5c36` (feat)

## Files Created/Modified
- `src/app/api/workshops/[id]/start/route.ts` - POST endpoint: scheduled/lobby -> live with recording trigger
- `src/app/api/workshops/[id]/end/route.ts` - POST endpoint: live -> ended with recording stop
- `src/app/api/workshops/[id]/token/route.ts` - GET endpoint: role-based Agora RTC token generation
- `src/app/api/workshops/recording-callback/route.ts` - POST webhook: processes Agora recording events into video library

## Decisions Made
- Cloud recording start/stop is fire-and-forget: if recording fails, the workshop continues normally, error is only logged
- Recording callback always returns HTTP 200 even on processing errors to prevent Agora from retrying indefinitely
- Token roles: host and co-host both map to PUBLISHER (video+audio), approved speakers also get PUBLISHER (client decides what to publish), regular attendees get SUBSCRIBER
- Workshop category_id is not mapped to video category_id when creating recording Video entries — set to null since category taxonomies differ
- Transaction with row lock (SELECT FOR UPDATE) used for start transition to prevent race condition between host clicking start and the no-show cron potentially cancelling the workshop

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workshop lifecycle state machine is fully enforced via API endpoints
- Recording pipeline (start -> record -> stop -> webhook -> video library) is complete
- Ready for client-side workshop room UI (plans 05-08 through 05-11)

---
*Phase: 05-workshops*
*Completed: 2026-02-15*
