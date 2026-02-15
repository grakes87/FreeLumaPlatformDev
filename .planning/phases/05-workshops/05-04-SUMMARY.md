---
phase: 05-workshops
plan: 04
subsystem: workshop-supporting-api
tags: [api, rsvp, invitations, notes, chat-replay, series, recurrence]
dependency-graph:
  requires: [05-01, 05-02, 05-03]
  provides: [workshop-rsvp-api, workshop-invite-api, workshop-notes-api, workshop-chat-replay-api, workshop-series-api]
  affects: [05-05, 05-06, 05-07, 05-08]
tech-stack:
  added: []
  patterns: [findOrCreate-idempotency, upsert-auto-save, rrule-instance-generation, fire-and-forget-notifications, ignoreDuplicates-bulk-create]
key-files:
  created:
    - src/app/api/workshops/[id]/rsvp/route.ts
    - src/app/api/workshops/[id]/invite/route.ts
    - src/app/api/workshops/[id]/notes/route.ts
    - src/app/api/workshops/[id]/chat/route.ts
    - src/app/api/workshops/series/route.ts
  modified: []
decisions:
  - id: ws-rsvp-idempotent
    decision: "RSVP uses findOrCreate for idempotency — duplicate RSVPs return existing rather than error"
  - id: ws-unrsvp-rsvp-only
    decision: "Un-RSVP only allowed from 'rsvp' status, not after user has 'joined' or 'left'"
  - id: ws-invite-50-limit
    decision: "Maximum 50 users per invite request to prevent abuse"
  - id: ws-notes-50k-limit
    decision: "Personal notes capped at 50,000 characters per workshop"
  - id: ws-chat-pagination
    decision: "Chat history paginated with default 500, max 1000 messages per request"
metrics:
  duration: 4 min
  completed: 2026-02-15
---

# Phase 5 Plan 4: Workshop Supporting API Routes Summary

Workshop RSVP toggle, user invitations, personal notes auto-save, chat replay history, and recurring series creation endpoints using findOrCreate idempotency, RRULE 90-day instance generation, and fire-and-forget notification dispatch.

## What Was Built

### Task 1: RSVP and Invite API Endpoints
- **POST /api/workshops/[id]/rsvp** -- RSVP to a workshop with capacity check, private workshop invite gate, findOrCreate idempotency, fire-and-forget attendee_count increment
- **DELETE /api/workshops/[id]/rsvp** -- Un-RSVP with status guard (only from 'rsvp', not 'joined'/'left'), fire-and-forget count decrement
- **POST /api/workshops/[id]/invite** -- Host/co-host only; validates active users, bulkCreate with ignoreDuplicates, sends WORKSHOP_INVITE notifications to each invitee

### Task 2: Notes and Chat History API Endpoints
- **GET /api/workshops/[id]/notes** -- Fetch personal notes for a workshop (unique per user+workshop pair)
- **PUT /api/workshops/[id]/notes** -- Upsert auto-save endpoint called with debounce from client; 50k char limit validated via Zod
- **GET /api/workshops/[id]/chat** -- Chat history for replay; returns messages ordered by offset_ms ascending with user info (display_name, avatar); paginated (default 500, max 1000)

### Task 3: Workshop Series API
- **GET /api/workshops/series** -- List active series with optional host filter; includes category info, workshop count (subquery), next scheduled instance (subquery)
- **POST /api/workshops/series** -- Create recurring series; validates can_host flag, builds RRULE string, generates 90-day horizon instances using generateInstancesInTimezone, bulk creates Workshop rows with agora_channel set per instance

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| RSVP uses findOrCreate | Idempotent -- double-click or retry returns existing RSVP without error |
| Un-RSVP restricted to 'rsvp' status | Once a user has joined a live workshop, removing the attendee row would lose tracking data |
| 50-user invite limit per request | Prevents abuse while allowing batch invitations |
| Notes 50k character cap | Generous for personal notes but prevents accidental megabyte storage |
| Chat pagination default 500, max 1000 | Balances replay completeness with response size for long workshops |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

1. POST /api/workshops/[id]/rsvp creates attendee and increments count -- verified
2. DELETE /api/workshops/[id]/rsvp removes attendee and decrements count -- verified
3. POST /api/workshops/[id]/invite sends notifications to invited users -- verified
4. GET/PUT /api/workshops/[id]/notes upserts personal notes -- verified
5. GET /api/workshops/[id]/chat returns time-ordered messages -- verified
6. POST /api/workshops/series creates series with generated instances -- verified
7. All TypeScript compiles cleanly -- verified (0 errors in workshop routes)

## Commits

| Hash | Message |
|------|---------|
| 6b27a3a | feat(05-04): RSVP and invite API endpoints |
| 30c93ea | feat(05-04): notes and chat history API endpoints |
| cb1f2fd | feat(05-04): workshop series API endpoint |

## Next Phase Readiness

Supporting API routes are complete. The workshop detail page (05-05+) can now wire up:
- RSVP button to POST/DELETE rsvp endpoint
- Invite modal to POST invite endpoint
- Notes panel to GET/PUT notes endpoint
- Chat replay sidebar to GET chat endpoint
- Series creation form to POST series endpoint
