---
phase: 15-admin-church-outreach-research-management
plan: 01
subsystem: database
tags: [sequelize, mysql, church-crm, pipeline, drip-sequences, email-campaigns]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: User model, Sequelize ORM setup, migration pattern
provides:
  - 11 church outreach CRM database tables (churches, activities, templates, campaigns, emails, unsubscribes, drip sequences, steps, enrollments, shipments, conversions)
  - 11 Sequelize models with TypeScript interfaces and creation attributes
  - PIPELINE_STAGES constant and PipelineStage type for pipeline management
  - Full association graph for church outreach CRM
affects: [15-02, 15-03, 15-04, 15-05, 15-06, 15-07, 15-08, 15-09, 15-10, 15-11, 15-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Church pipeline ENUM with 7 stages (new_lead, contacted, engaged, sample_requested, sample_sent, converted, lost)"
    - "Deferred FK constraint pattern: outreach_emails.drip_enrollment_id created without FK in migration 109, constraint added in migration 113"
    - "Append-only models with updatedAt:false for activity logs, emails, unsubscribes, conversions"

key-files:
  created:
    - src/lib/db/migrations/105-create-churches.cjs
    - src/lib/db/migrations/106-create-church-activities.cjs
    - src/lib/db/migrations/107-create-outreach-templates.cjs
    - src/lib/db/migrations/108-create-outreach-campaigns.cjs
    - src/lib/db/migrations/109-create-outreach-emails.cjs
    - src/lib/db/migrations/110-create-outreach-unsubscribes.cjs
    - src/lib/db/migrations/111-create-drip-sequences.cjs
    - src/lib/db/migrations/112-create-drip-steps.cjs
    - src/lib/db/migrations/113-create-drip-enrollments.cjs
    - src/lib/db/migrations/114-create-sample-shipments.cjs
    - src/lib/db/migrations/115-create-church-conversions.cjs
    - src/lib/db/models/Church.ts
    - src/lib/db/models/ChurchActivity.ts
    - src/lib/db/models/OutreachTemplate.ts
    - src/lib/db/models/OutreachCampaign.ts
    - src/lib/db/models/OutreachEmail.ts
    - src/lib/db/models/OutreachUnsubscribe.ts
    - src/lib/db/models/DripSequence.ts
    - src/lib/db/models/DripStep.ts
    - src/lib/db/models/DripEnrollment.ts
    - src/lib/db/models/SampleShipment.ts
    - src/lib/db/models/ChurchConversion.ts
  modified:
    - src/lib/db/models/index.ts

key-decisions:
  - "7-stage pipeline ENUM: new_lead, contacted, engaged, sample_requested, sample_sent, converted, lost"
  - "Deferred FK constraint for outreach_emails.drip_enrollment_id to avoid cross-migration ordering issues"
  - "Append-only tables (no updatedAt) for ChurchActivity, OutreachEmail, OutreachUnsubscribe, ChurchConversion"
  - "ChurchConversion has unique church_id constraint (one conversion per church)"
  - "drip_steps unique index on (sequence_id, step_order) for ordering integrity"

patterns-established:
  - "PIPELINE_STAGES const array with PipelineStage type exported from Church.ts"
  - "Church source ENUM: google_places, manual, sample_request"
  - "ChurchActivity append-only log with 10 activity types"

requirements-completed: [CO-01, CO-02, CO-03]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 15 Plan 01: Database Schema & Models Summary

**11 church outreach CRM tables with Sequelize migrations, TypeScript models, and full association graph for pipeline management, email campaigns, drip sequences, and conversion tracking**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T20:49:12Z
- **Completed:** 2026-03-09T20:53:47Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- Created 11 database tables covering the complete church outreach CRM domain
- Built 11 TypeScript Sequelize models with full type safety (interfaces, creation attributes, ENUM types)
- Registered all associations in models/index.ts with proper cascade/restrict/set-null FK behaviors
- Exported PIPELINE_STAGES constant for reuse across API routes and UI components

## Task Commits

Each task was committed atomically:

1. **Task 1: Create all 11 database migrations** - `24cbd4b` (feat)
2. **Task 2: Create all 11 Sequelize models and register associations** - `e1979f5` (feat)

## Files Created/Modified
- `src/lib/db/migrations/105-create-churches.cjs` - Churches table with pipeline ENUM, address fields, JSON columns
- `src/lib/db/migrations/106-create-church-activities.cjs` - Append-only activity log with 10 types
- `src/lib/db/migrations/107-create-outreach-templates.cjs` - Email templates with LONGTEXT body
- `src/lib/db/migrations/108-create-outreach-campaigns.cjs` - Campaign tracking with counters
- `src/lib/db/migrations/109-create-outreach-emails.cjs` - Individual email records with UUID tracking
- `src/lib/db/migrations/110-create-outreach-unsubscribes.cjs` - Email unsubscribe tracking
- `src/lib/db/migrations/111-create-drip-sequences.cjs` - Drip sequence definitions
- `src/lib/db/migrations/112-create-drip-steps.cjs` - Ordered steps within sequences
- `src/lib/db/migrations/113-create-drip-enrollments.cjs` - Church enrollment tracking + deferred FK
- `src/lib/db/migrations/114-create-sample-shipments.cjs` - Bracelet shipment logging
- `src/lib/db/migrations/115-create-church-conversions.cjs` - Conversion records (one per church)
- `src/lib/db/models/Church.ts` - Church model with PIPELINE_STAGES and PipelineStage type
- `src/lib/db/models/ChurchActivity.ts` - Activity model with CHURCH_ACTIVITY_TYPES
- `src/lib/db/models/OutreachTemplate.ts` - Template model with merge fields
- `src/lib/db/models/OutreachCampaign.ts` - Campaign model with CAMPAIGN_STATUSES
- `src/lib/db/models/OutreachEmail.ts` - Email model with OUTREACH_EMAIL_STATUSES
- `src/lib/db/models/OutreachUnsubscribe.ts` - Unsubscribe model
- `src/lib/db/models/DripSequence.ts` - Sequence model with DRIP_TRIGGERS
- `src/lib/db/models/DripStep.ts` - Step model
- `src/lib/db/models/DripEnrollment.ts` - Enrollment model with ENROLLMENT_STATUSES
- `src/lib/db/models/SampleShipment.ts` - Shipment model with CARRIER_TYPES
- `src/lib/db/models/ChurchConversion.ts` - Conversion model
- `src/lib/db/models/index.ts` - 11 new imports, associations section, exports

## Decisions Made
- **7-stage pipeline:** new_lead, contacted, engaged, sample_requested, sample_sent, converted, lost -- maps directly to the church outreach sales cycle with clear actions at each stage
- **Deferred FK constraint:** outreach_emails.drip_enrollment_id created as plain INTEGER in migration 109, then FK constraint added in migration 113 after drip_enrollments table exists -- avoids cross-migration ordering issues
- **Append-only tables:** ChurchActivity, OutreachEmail, OutreachUnsubscribe, ChurchConversion use updatedAt:false for immutable audit records
- **Unique church_id on conversions:** One conversion record per church enforced at DB level
- **JSON columns for flexible data:** staff_names, youth_programs, service_times, social_media, filter_criteria, metadata stored as JSON for schema flexibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 11 database tables and models are ready for API route development
- PIPELINE_STAGES constant available for kanban board UI and API validation
- Association graph supports all planned queries (church detail with activities, campaign with emails, sequence with steps, etc.)
- Ready for plan 15-02 (discovery/research APIs) and beyond

---
*Phase: 15-admin-church-outreach-research-management*
*Completed: 2026-03-09*
