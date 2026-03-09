---
phase: 15-admin-church-outreach-research-management
plan: 04
subsystem: api
tags: [church-crm, google-places, web-scraping, ai-research, crud, pipeline, cursor-pagination]

# Dependency graph
requires:
  - phase: 15-01
    provides: "Church and ChurchActivity Sequelize models, PIPELINE_STAGES constant"
  - phase: 15-02
    provides: "searchChurches(), scrapeChurchWebsite(), researchChurch() library modules"
provides:
  - "Church CRUD endpoints (list, create, get, update, delete) with cursor pagination and filtering"
  - "Church activity history endpoint with cursor pagination"
  - "Pipeline stage update endpoint with activity logging"
  - "Google Places discovery search endpoint with already_imported detection"
  - "Web scrape + AI research endpoint with graceful degradation"
  - "Batch import endpoint with duplicate detection and activity logging"
affects: [15-05, 15-06, 15-07, 15-08, 15-09, 15-10, 15-11, 15-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "withAdmin + dynamic import pattern for all church outreach API routes"
    - "Google Places address parsing into structured address components"
    - "Discovery pipeline: search -> scrape -> research -> import with partial success handling"

key-files:
  created:
    - src/app/api/admin/church-outreach/churches/route.ts
    - src/app/api/admin/church-outreach/churches/[id]/route.ts
    - src/app/api/admin/church-outreach/churches/[id]/activities/route.ts
    - src/app/api/admin/church-outreach/pipeline/route.ts
    - src/app/api/admin/church-outreach/discover/route.ts
    - src/app/api/admin/church-outreach/discover/scrape/route.ts
    - src/app/api/admin/church-outreach/discover/import/route.ts
  modified: []

key-decisions:
  - "Cursor-based pagination on all list endpoints for consistent UX with existing admin APIs"
  - "Pipeline stage changes logged as ChurchActivity entries with old_stage/new_stage metadata"
  - "Discovery search checks existing google_place_id to mark already_imported results"
  - "Import parses Google Places formatted addresses into line1/city/state/zip components"
  - "Scrape endpoint returns partial results (scraped without research) rather than failing entirely"

patterns-established:
  - "Church outreach API routes follow withAdmin + Zod validation + successResponse/errorResponse pattern"
  - "Import batch limited to 100 churches per request to prevent timeout"
  - "Activity logging on all CRM state changes (create, stage_change, scrape, research)"

requirements-completed: [CO-04, CO-05, CO-08]

# Metrics
duration: 9min
completed: 2026-03-09
---

# Phase 15 Plan 04: Church Discovery & Management API Routes Summary

**7 API routes for church CRUD with cursor pagination, pipeline stage management with activity logging, and three-step discovery workflow (Google Places search, web scrape + AI research, batch import with duplicate detection)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-09T21:01:54Z
- **Completed:** 2026-03-09T21:11:20Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built complete church CRUD API with list (cursor pagination + stage/state/search filters), create, get (with latest activities), update (with stage change logging), and delete
- Created discovery workflow: Google Places search with already_imported detection, website scrape + AI research with graceful degradation, batch import with duplicate detection
- Pipeline stage update endpoint logs old_stage/new_stage transitions as ChurchActivity entries
- All routes use withAdmin middleware and Zod validation consistent with existing admin API patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Create church CRUD, activity history, and pipeline API routes** - `b713dc7` (feat)
2. **Task 2: Create discovery API routes (search, scrape, import)** - `26ef9d9` (feat)

## Files Created/Modified
- `src/app/api/admin/church-outreach/churches/route.ts` - GET list with cursor pagination + stage/state/search filters; POST create with manual source
- `src/app/api/admin/church-outreach/churches/[id]/route.ts` - GET single with latest 10 activities; PUT update with stage change logging; DELETE hard delete
- `src/app/api/admin/church-outreach/churches/[id]/activities/route.ts` - GET activity history with cursor pagination
- `src/app/api/admin/church-outreach/pipeline/route.ts` - PUT pipeline stage update with old/new metadata
- `src/app/api/admin/church-outreach/discover/route.ts` - POST Google Places search with already_imported flag
- `src/app/api/admin/church-outreach/discover/scrape/route.ts` - POST web scrape + AI research with partial result support
- `src/app/api/admin/church-outreach/discover/import/route.ts` - POST batch import with duplicate detection, address parsing, activity logging

## Decisions Made
- Cursor-based pagination (ID-based DESC) on all list endpoints matches existing admin API pattern (admin/users)
- Pipeline stage changes create ChurchActivity entries with `{old_stage, new_stage}` metadata for full audit trail
- Discovery search marks results as `already_imported` by checking `google_place_id` in churches table before returning
- Import endpoint parses Google Places formatted address ("123 Main St, City, ST 12345, USA") into structured components
- Scrape endpoint returns `{scraped: null, research: null}` with a message on failure rather than throwing, matching the never-throw pattern of the scraper module

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Zod v4 `z.record()` requires two arguments (key type + value type); fixed by using `z.record(z.string(), z.string())`
- Zod `z.enum()` with `as unknown as [string, ...]` cast widens pipeline_stage to `string`; fixed with explicit type cast on `church.update()` call

## User Setup Required

None - no external service configuration required. Google Places API key and Anthropic API key are optional environment variables; endpoints degrade gracefully when not set.

## Next Phase Readiness
- All 7 API route files ready to be consumed by the admin UI (plan 15-05)
- Discovery workflow complete: search -> scrape -> research -> import
- Pipeline management endpoints ready for kanban board UI
- Activity logging captures all CRM state changes for audit trail

---
*Phase: 15-admin-church-outreach-research-management*
*Completed: 2026-03-09*
