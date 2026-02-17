---
phase: 12-content-production-platform
plan: 04
subsystem: content-pipeline
tags: [creator-management, CRUD, middleware, round-robin, assignment]
depends_on: ["12-01"]
provides: ["creator-crud-api", "withCreator-middleware", "auto-assign-month", "reassign-day"]
affects: ["12-05", "12-06", "12-07", "12-08"]
tech-stack:
  added: []
  patterns: ["round-robin-assignment", "withCreator-HOF-middleware"]
key-files:
  created:
    - src/app/api/admin/content-production/creators/route.ts
    - src/app/api/admin/content-production/creators/[id]/route.ts
    - src/lib/content-pipeline/assignment.ts
  modified:
    - src/lib/auth/middleware.ts
decisions:
  - "CreatorContext uses LumaShortCreatorAttributes interface type (not class InstanceType) for clean typing"
  - "Soft-deactivate resets pending content status to 'generated' and nulls creator_id"
  - "Round-robin is deterministic (creators ordered by id ASC)"
  - "reassignDay blocks approved content but allows submitted/rejected reassignment"
metrics:
  duration: 3 min
  completed: 2026-02-17
---

# Phase 12 Plan 04: Creator Management & Assignment Summary

Creator CRUD API with withCreator middleware and round-robin auto-assignment distributing daily content to eligible creators by mode/capacity.

## What Was Done

### Task 1: withCreator Middleware + Creator CRUD API (0c5cf28)

**withCreator middleware** added to `src/lib/auth/middleware.ts`:
- Follows existing withAdmin/withModerator pattern exactly
- Wraps withAuth, lazy-imports LumaShortCreator model
- Finds active creator by user_id, returns 403 if not found
- Exports CreatorContext interface with creator attributes

**Creator CRUD API:**
- `GET /api/admin/content-production/creators` -- lists all creators with associated user data (username, avatar_url, avatar_color), filterable by `?active=true|false`, ordered by name ASC
- `POST /api/admin/content-production/creators` -- creates creator with full Zod validation (user_id, name, languages, capacity, mode flags, AI settings), verifies user exists, checks no duplicate active profile (409)
- `PUT /api/admin/content-production/creators/[id]` -- partial update with Zod validation, all fields optional
- `DELETE /api/admin/content-production/creators/[id]` -- soft-deactivates (active=false), transactionally unassigns pending work (generated/assigned status content gets creator_id=null and status reset to 'generated'), preserves completed/submitted/approved assignments

### Task 2: Round-Robin Assignment Module (fd402ff)

**autoAssignMonth(month, mode):**
- Parses YYYY-MM format, calculates date range
- Queries eligible creators filtered by mode flag (can_bible or can_positivity) + active, ordered by id ASC for determinism
- Counts existing assignments per creator to track capacity usage
- Fetches unassigned 'generated' content for the month
- Round-robin loop cycles through creators, skipping those at monthly_capacity
- Breaks early if all creators at capacity
- Returns { assigned, skipped } counts

**reassignDay(dailyContentId, newCreatorId):**
- Validates content exists and is not 'approved' (throws error)
- Validates creator exists, is active, and supports the content mode
- Updates creator_id; upgrades status from 'generated' to 'assigned'
- For already assigned/submitted/rejected content, only changes creator (keeps status)

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compilation passes clean (npx tsc --noEmit)
- All 4 CRUD operations wrapped with withAdmin
- withCreator follows withAuth/withAdmin HOF pattern
- Round-robin respects mode flags and capacity limits
- Soft-deactivation correctly unassigns pending but preserves completed work

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 0c5cf28 | feat | withCreator middleware and creator CRUD API |
| fd402ff | feat | Round-robin creator assignment module |
