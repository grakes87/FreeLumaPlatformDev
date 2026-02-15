---
phase: 05-workshops
plan: 01
subsystem: database
tags: [sequelize, models, migrations, agora, rrule, workshops]
depends_on:
  requires: [phase-04]
  provides: [workshop-models, workshop-migrations, notification-enums]
  affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12, 05-13, 05-14]
tech_stack:
  added: [agora-rtc-react@2.5.1, agora-token@2.0.5, rrule@2.8.1]
  patterns: [workshop-model-hierarchy, rrule-series-scheduling, agora-channel-naming]
key_files:
  created:
    - src/lib/db/models/WorkshopCategory.ts
    - src/lib/db/models/WorkshopSeries.ts
    - src/lib/db/models/Workshop.ts
    - src/lib/db/models/WorkshopAttendee.ts
    - src/lib/db/models/WorkshopChat.ts
    - src/lib/db/models/WorkshopNote.ts
    - src/lib/db/models/WorkshopInvite.ts
    - src/lib/db/migrations/057-create-workshop-categories.cjs
    - src/lib/db/migrations/058-create-workshop-series.cjs
    - src/lib/db/migrations/059-create-workshops.cjs
    - src/lib/db/migrations/060-create-workshop-attendees.cjs
    - src/lib/db/migrations/061-create-workshop-chats.cjs
    - src/lib/db/migrations/062-create-workshop-notes.cjs
    - src/lib/db/migrations/063-create-workshop-invites.cjs
    - src/lib/db/migrations/064-add-can-host-to-users.cjs
    - src/lib/db/migrations/065-extend-notification-enums-workshops.cjs
  modified:
    - src/lib/db/models/index.ts
    - src/lib/db/models/Notification.ts
    - src/lib/db/models/User.ts
    - package.json
    - .env.example
decisions:
  - "WorkshopSeries time_of_day stored as STRING(8) not TIME for Sequelize compatibility"
  - "Workshop host_id uses ON DELETE RESTRICT to prevent deletion of hosts with workshops"
  - "WorkshopChat uses timestamps:true with updatedAt:false for append-only chat log"
  - "WorkshopInvite uses timestamps:true with updatedAt:false since invites are immutable"
  - "Notification entity_type extended with 'workshop' for workshop-related notifications"
  - "User can_host column defaults to true, allowing admin revocation per user"
metrics:
  duration: 6 min
  completed: 2026-02-15
---

# Phase 5 Plan 1: Workshop Database Foundation Summary

**One-liner:** 7 workshop Sequelize models with 9 migrations (tables, user column, notification ENUM) plus agora-rtc-react, agora-token, rrule npm packages

## What Was Done

### Task 1: Install npm dependencies and add env vars
- Installed `agora-rtc-react@2.5.1`, `agora-token@2.0.5`, `rrule@2.8.1`
- Added 5 Agora environment variables to `.env.example`
- Commit: `6aff739`

### Task 2: Create 7 workshop models and 9 migrations
- Created 7 model files with full TypeScript interfaces (Attributes + CreationAttributes)
- Created 7 table migrations (057-063) with FKs, indexes, unique constraints
- Created migration 064 to add `can_host` boolean to users table
- Created migration 065 to extend notification type ENUM with 6 workshop types and entity_type with 'workshop'
- Updated `Notification.ts` and `User.ts` models with new fields
- All 9 migrations ran successfully
- Commit: `9a1d907`

### Task 3: Register all associations and exports in model index
- Imported all 7 workshop models in index.ts
- Registered 14 bidirectional associations with proper aliases
- Added all 7 models to the export block
- Zero workshop-related TypeScript errors
- Commit: `51ee081`

## Schema Overview

| Table | Key Fields | Constraints |
|-------|-----------|-------------|
| workshop_categories | name, slug, sort_order, is_active | slug UNIQUE |
| workshop_series | host_id, rrule, time_of_day, timezone | host_id FK RESTRICT |
| workshops | host_id, series_id, status, scheduled_at, agora_channel | status ENUM, 4 indexes |
| workshop_attendees | workshop_id, user_id, status, is_co_host, can_speak | (workshop_id, user_id) UNIQUE |
| workshop_chats | workshop_id, user_id, message, offset_ms | (workshop_id, offset_ms) index |
| workshop_notes | workshop_id, user_id, content | (workshop_id, user_id) UNIQUE |
| workshop_invites | workshop_id, user_id, invited_by | (workshop_id, user_id) UNIQUE |

## Decisions Made

1. **WorkshopSeries time_of_day as STRING(8):** Stored as string (e.g. "19:00:00") instead of TIME type for Sequelize cross-database compatibility
2. **Host FK RESTRICT strategy:** Workshop and WorkshopSeries use ON DELETE RESTRICT on host_id to prevent accidental host user deletion
3. **Append-only chat/invite models:** WorkshopChat and WorkshopInvite use `updatedAt: false` since they are immutable records
4. **Notification ENUM extension:** Added 6 workshop notification types (reminder, cancelled, invite, recording, updated, started) and 'workshop' entity_type
5. **User can_host default true:** All users can host by default; admin can revoke via setting can_host=false

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. `npm ls agora-rtc-react agora-token rrule` -- all three packages listed
2. `npx sequelize-cli db:migrate:status` -- all 9 new migrations show as "up"
3. TypeScript compiles with zero workshop-related errors
4. All 7 tables created with correct columns and constraints
5. User table has `can_host` boolean column defaulting to true
6. Notification type ENUM includes all 6 workshop types

## Next Phase Readiness

All database models and tables are in place for Wave 2 (05-02 through 05-05) to build workshop CRUD APIs, Agora token generation, and real-time Socket.IO events on top of this schema.
