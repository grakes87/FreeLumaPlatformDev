---
phase: 05-workshops
plan: 03
subsystem: workshops-api
tags: [workshops, crud, api, categories, pagination, authorization]
completed: 2026-02-15
duration: 3 min
requires: [05-01, 05-02]
provides:
  - Workshop CRUD API (list, create, detail, update, cancel)
  - Workshop categories admin CRUD API
  - Private workshop access control
  - Host-only authorization for edit/cancel
affects: [05-04, 05-05, 05-06, 05-07]
tech-stack:
  added: []
  patterns:
    - cursor-based pagination for workshop listing
    - private resource access control (host/co-host/invited)
    - can_host flag gating for workshop creation
    - fire-and-forget notifications for schedule changes and cancellations
key-files:
  created:
    - src/app/api/workshops/route.ts
    - src/app/api/workshops/[id]/route.ts
    - src/app/api/workshops/categories/route.ts
  modified: []
decisions:
  - "Private workshop filtering applied in application layer after DB query (not SQL-level) for flexibility"
  - "Workshop categories DELETE nullifies category_id on referencing workshops rather than blocking deletion"
  - "RSVP status batch-fetched in list endpoint to avoid N+1 queries"
---

# Phase 5 Plan 3: Workshop CRUD API Summary

Core workshop CRUD API endpoints with category management, private workshop access control, and host authorization.

## One-Liner

Workshop CRUD API with category admin, private access control, host-only edit/cancel, and 15-min lead time validation.

## What Was Built

### Task 1: Workshop Categories API (Admin CRUD)
- **GET /api/workshops/categories** - Lists active categories with `workshop_count` via Sequelize literal subquery (counts non-cancelled workshops)
- **POST /api/workshops/categories** - Admin creates category with auto-generated slug and auto-incremented sort_order
- **PUT /api/workshops/categories** - Admin updates category fields with slug uniqueness check
- **DELETE /api/workshops/categories** - Admin deletes category, nullifies `category_id` on referencing workshops
- Follows exact pattern from `src/app/api/video-categories/route.ts`

### Task 2: Workshop List and Create API
- **GET /api/workshops** - Lists upcoming workshops with comprehensive filters:
  - `category` - filter by category_id
  - `status` - filter by specific status
  - `host` - filter by host_id
  - `past=true` - show ended workshops
  - `my=true` - show workshops where user is host or RSVP'd
  - `cursor` + `limit` - cursor-based pagination
  - Private workshops excluded for non-invited users
  - User's RSVP status and `is_host` flag included per workshop
  - Host info and category included via Sequelize associations
- **POST /api/workshops** - Creates workshop with validations:
  - `can_host=true` check on user
  - Active account status check
  - 15-minute minimum lead time for `scheduled_at`
  - Category existence check if `category_id` provided
  - Auto-generates `agora_channel` as `workshop-{id}`

### Task 3: Workshop Detail, Update, and Cancel API
- **GET /api/workshops/[id]** - Workshop detail with:
  - Host info (id, display_name, username, avatar_url, avatar_color, bio)
  - Category and series info (with rrule)
  - User's RSVP status (status, is_co_host, can_speak)
  - `is_host` flag, `has_recording` flag
  - Next workshop in series (if part of a series)
  - Private workshop access control (returns 404 for unauthorized)
- **PUT /api/workshops/[id]** - Host-only update:
  - Validates host ownership
  - Only allows editing workshops in `scheduled` status
  - Same validation as create (title, description, category_id, scheduled_at, etc.)
  - Fire-and-forget `WORKSHOP_UPDATED` notifications on schedule change
- **DELETE /api/workshops/[id]** - Host-only cancellation:
  - Sets status to `cancelled`
  - Fire-and-forget `WORKSHOP_CANCELLED` notifications to all RSVP'd attendees
  - Rejects if already ended or cancelled

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Private workshop filtering in application layer** - After fetching from DB, private workshops are filtered by checking host_id, co-host status, invite, and RSVP. This avoids complex SQL subqueries while maintaining correct access control.

2. **Category deletion nullifies rather than blocks** - When a workshop category is deleted, referencing workshops have their `category_id` set to null rather than preventing deletion. This is safer for admin workflows.

3. **Batch RSVP lookup in list endpoint** - User's RSVP status for all workshops in a page is fetched in a single query using `IN` clause, avoiding N+1 queries.

## Verification

1. GET /api/workshops returns upcoming workshops with host info and category - VERIFIED (includes associations, pagination, filters)
2. POST /api/workshops creates workshop with validation - VERIFIED (can_host, 15-min lead, category check)
3. GET /api/workshops/[id] returns workshop detail with RSVP status - VERIFIED (includes series, next-in-series)
4. PUT /api/workshops/[id] updates workshop (host only, scheduled only) - VERIFIED (with notifications)
5. DELETE /api/workshops/[id] cancels workshop (host only) - VERIFIED (with notifications)
6. Workshop categories CRUD works for admin - VERIFIED (follows video-categories pattern)
7. Private workshops hidden from non-invited users - VERIFIED (404 returned)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | ed6e928 | feat(05-03): workshop categories API (admin CRUD) |
| 2 | 77deb1b | feat(05-03): workshop list and create API |
| 3 | 23b1a47 | feat(05-03): workshop detail, update, and cancel API |

## Next Phase Readiness

No blockers. The CRUD API is ready for:
- **05-04**: RSVP endpoints can reference workshop detail/list
- **05-05**: Start/end lifecycle endpoints can update workshop status
- **05-06**: Agora token endpoint can verify workshop access
- **05-07**: Workshop UI pages can consume these API endpoints
