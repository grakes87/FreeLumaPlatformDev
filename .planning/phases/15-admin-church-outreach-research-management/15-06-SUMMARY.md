---
phase: 15-admin-church-outreach-research-management
plan: 06
subsystem: api
tags: [drip-sequences, cron, email-automation, enrollment, node-cron]

# Dependency graph
requires:
  - phase: 15-01
    provides: "DripSequence, DripStep, DripEnrollment, Church, OutreachEmail, ChurchActivity models"
  - phase: 15-03
    provides: "sendOutreachEmail(), renderTemplate(), renderSubject(), tracking utilities"
provides:
  - "GET/POST /api/admin/church-outreach/sequences for drip sequence listing and creation"
  - "GET/PUT/DELETE /api/admin/church-outreach/sequences/[id] for sequence detail, update, delete"
  - "POST/PUT /api/admin/church-outreach/sequences/[id]/enroll for church enrollment and status management"
  - "initDripScheduler() cron function (15-min interval)"
  - "processPendingDripSteps() for automated drip email dispatch with row locking"
  - "enrollInDripSequence() for trigger-based auto-enrollment"
affects: [15-08, 15-09, 15-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SELECT...FOR UPDATE row locking in drip step processing to prevent race conditions"
    - "globalThis.__dripSchedulerReady guard pattern matching email scheduler"
    - "Fire-and-forget per-enrollment error handling in cron processor"
    - "Enrollment state machine: active -> paused -> active, active -> cancelled, active -> completed"

key-files:
  created:
    - src/app/api/admin/church-outreach/sequences/route.ts
    - src/app/api/admin/church-outreach/sequences/[id]/route.ts
    - src/app/api/admin/church-outreach/sequences/[id]/enroll/route.ts
    - src/lib/church-outreach/drip-scheduler.ts
  modified: []

key-decisions:
  - "Used Zod .issues (not .errors) for error formatting to match Zod v4 API and project conventions"
  - "Enrollment pause clears next_step_at; resume recalculates from current_step with fresh delay"
  - "Delete sequence returns 409 if active enrollments exist (prevents orphaned drip emails)"
  - "Unsubscribed churches get enrollment cancelled at processing time (not just skipped)"

patterns-established:
  - "Drip enrollment state transitions validated server-side (pause only active, resume only paused, cancel only active/paused)"
  - "Cron scheduler uses SELECT...FOR UPDATE to prevent duplicate processing under concurrent execution"

requirements-completed: [CO-10]

# Metrics
duration: 11min
completed: 2026-03-09
---

# Phase 15 Plan 06: Drip Sequence Management Summary

**Drip sequence CRUD APIs with enrollment state management and cron-driven scheduler using row locking for automated multi-step email campaigns**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-09T21:02:12Z
- **Completed:** 2026-03-09T21:13:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Full CRUD for drip sequences with transactional step management (create/replace steps atomically)
- Church enrollment API with batch support, unsubscribe checking, and pause/resume/cancel state transitions
- Cron scheduler processes pending enrollments every 15 minutes with SELECT...FOR UPDATE locking
- Auto-enrollment function for trigger-based sequences (sample_shipped, stage_change)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create drip sequence CRUD and enrollment API routes** - `1f57ec5` (feat)
2. **Task 2: Create drip sequence cron scheduler** - `fa00362` (feat)

## Files Created/Modified
- `src/app/api/admin/church-outreach/sequences/route.ts` - GET list with counts (step, enrollment, active), POST create sequence + steps in transaction
- `src/app/api/admin/church-outreach/sequences/[id]/route.ts` - GET detail with template names, PUT update with optional step replacement, DELETE with active enrollment guard (409)
- `src/app/api/admin/church-outreach/sequences/[id]/enroll/route.ts` - POST batch enroll with unsubscribe check, PUT pause/resume/cancel state transitions
- `src/lib/church-outreach/drip-scheduler.ts` - initDripScheduler() cron, processPendingDripSteps() with row locking, enrollInDripSequence() for auto-enrollment

## Decisions Made
- Used `.issues` (not `.errors`) on Zod parse failures to match Zod v4 API used throughout the project
- Enrollment pause clears next_step_at to null; resume recalculates based on current_step and next step's delay_days from current time
- Sequence deletion blocked (409) when active enrollments exist to prevent orphaned drip emails mid-sequence
- Unsubscribed churches get their enrollment cancelled (not just skipped) during cron processing to prevent future retries
- No-email churches are skipped but not cancelled (they may add a contact email later)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 API usage (.issues instead of .errors)**
- **Found during:** Task 1 (sequence CRUD routes)
- **Issue:** Plan referenced `parsed.error.errors` which is Zod v3 API; project uses Zod v4 which uses `parsed.error.issues`
- **Fix:** Changed all Zod error formatting to use `.issues` with explicit type annotation on map callback
- **Files modified:** All 3 route files
- **Verification:** `npx tsc --noEmit` passes with zero errors in sequences routes
- **Committed in:** `1f57ec5` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed DELETE handler return type for withAdmin compatibility**
- **Found during:** Task 1 (sequence [id] route)
- **Issue:** `new Response(null, { status: 204 })` returns `Response` not `NextResponse`, incompatible with `withAdmin` handler type
- **Fix:** Changed to `new NextResponse(null, { status: 204 })` and added NextResponse import
- **Files modified:** `src/app/api/admin/church-outreach/sequences/[id]/route.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** `1f57ec5` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The drip scheduler will be initialized in server.js (wired in plan 15-12 integration).

## Next Phase Readiness
- Drip sequence APIs ready for admin UI integration (sequence builder, enrollment management)
- Cron scheduler ready to be wired into server.js via `globalThis.__initDripScheduler()`
- `enrollInDripSequence()` ready to be called from sample shipment API for auto-enrollment
- All functions exported and TypeScript clean

---
*Phase: 15-admin-church-outreach-research-management*
*Completed: 2026-03-09*
