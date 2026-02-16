---
phase: 09-platform-refinements-and-admin-tools
plan: 03
subsystem: admin-tools
tags: [workshops, admin, proxy-creation, notifications]
dependency-graph:
  requires: [05-workshops, 09-01, 09-02]
  provides: [admin-proxy-workshop-creation, created-by-admin-tracking]
  affects: [09-04, 09-05, 09-06]
tech-stack:
  added: []
  patterns: [admin-proxy-creation, auto-enable-privileges]
key-files:
  created:
    - src/lib/db/migrations/073-add-created-by-admin-to-workshops.cjs
  modified:
    - src/lib/db/models/Workshop.ts
    - src/lib/db/models/index.ts
    - src/app/api/admin/workshops/route.ts
    - src/app/(admin)/admin/workshops/page.tsx
decisions:
  - Inline creation form in modal instead of reusing CreateWorkshopForm (admin flow submits to different API endpoint)
  - Host search uses existing admin users API with status=active filter
  - WORKSHOP_UPDATED notification type reused for proxy creation notification
metrics:
  duration: 5 min
  completed: 2026-02-16
---

# Phase 9 Plan 3: Admin Proxy Workshop Creation Summary

Admin can create workshops on behalf of any user via the admin workshops page, with host search, auto-enable can_host, host notification, and admin attribution tracking via indigo badge.

## What Was Done

### Task 1: Database migration, model update, and API endpoint
- **Migration 073:** Added `created_by_admin_id` nullable FK column to workshops table (references users.id, ON DELETE SET NULL)
- **Workshop model:** Added `created_by_admin_id` field to attributes, creation attributes, class declaration, and init()
- **Association:** `Workshop.belongsTo(User, { as: 'createdByAdmin' })` in models/index.ts
- **Admin API GET:** Now includes `created_by_admin_id` in attributes and `createdByAdmin` User association (id, display_name, username)
- **Admin API PUT:** Extended schema with `create_on_behalf` action plus optional workshop fields (host_id, title, description, category_id, scheduled_at, duration_minutes, is_private)
- **create_on_behalf handler:** Validates host exists and is active, auto-enables can_host if disabled, creates workshop with admin attribution, sends WORKSHOP_UPDATED notification to host

### Task 2: Admin workshops page UI
- **"Create on Behalf" button** in page header with UserPlus icon
- **Host search picker:** Debounced search (300ms) against `/api/admin/users?search=...&status=active&limit=10`, displays user cards with avatar/name/username
- **Inline creation form:** Shown after host selection with title, description, category dropdown, date/time, duration, privacy toggle
- **Form submission:** Calls admin API with `action: 'create_on_behalf'` and all workshop fields
- **Admin badge:** Indigo "Created by admin" badge on workshop cards where `created_by_admin_id` is non-null
- **Post-creation:** Toast notification "Workshop created for @{username}", modal close, list refresh
- **Workshop type interface:** Updated with `created_by_admin_id` and `createdByAdmin` fields

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | d627d5f | feat(09-03): migration, model, and API for admin proxy workshop creation |
| 2 | 5ef348d | feat(09-03): admin workshops page UI for proxy workshop creation |

## Decisions Made

1. **Inline form over reuse of CreateWorkshopForm:** The existing CreateWorkshopForm component posts directly to the user-facing workshop API. For the admin proxy flow, a lightweight inline form was built that submits to the admin API endpoint instead. This avoids overcomplicating the existing form with conditional logic.

2. **WORKSHOP_UPDATED notification reused:** Rather than adding a new notification type, the existing WORKSHOP_UPDATED type is used with a custom preview_text that clarifies it was admin-created.

3. **Host search uses admin users API:** The existing `/api/admin/users?search=...` endpoint already supports name/username/email search with status filtering, so it was reused rather than creating a new endpoint.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] Migration 073 applied (created_by_admin_id on workshops)
- [x] Admin workshops API supports create_on_behalf action
- [x] Admin workshops page has "Create on Behalf" button and workflow
- [x] Created workshops show admin attribution badge in admin view
- [x] Host notification sent on creation
- [x] can_host auto-enabled for target user
- [x] TypeScript compiles without errors
- [x] `npx next build` succeeds
