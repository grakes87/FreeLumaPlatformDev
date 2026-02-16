---
phase: 09-platform-refinements-and-admin-tools
plan: 02
subsystem: activation-codes
tags: [activation-codes, schema, migration, admin-api, import]
depends_on:
  requires: [01-foundation, 08-database-migration-mapping]
  provides: [activation-code-source-tracking, used-at-timestamp, import-old-codes, never-expire-codes]
  affects: [09-03-activation-code-admin-ui]
tech_stack:
  added: []
  patterns: [source-enum-tracking, never-expire-pattern, idempotent-import]
key_files:
  created:
    - src/lib/db/migrations/072-activation-code-source-and-used-at.cjs
  modified:
    - src/lib/db/models/ActivationCode.ts
    - src/app/api/admin/activation-codes/route.ts
    - scripts/import-old-data.mjs
decisions:
  - id: ac-never-expire
    decision: "All generated activation codes use expires_at=9999-12-31 (effectively never expire)"
    rationale: "Per CONTEXT decision, codes should not expire"
  - id: ac-keep-dashes
    decision: "Imported codes keep dashes (XXXX-XXXX-XXXX format, 14 chars)"
    rationale: "Preserve original format, code column widened to VARCHAR(16)"
  - id: ac-source-enum
    decision: "Source column uses ENUM('generated','imported') with default 'generated'"
    rationale: "Distinguish between admin-generated and legacy imported codes"
metrics:
  duration: 4 min
  completed: 2026-02-16
---

# Phase 9 Plan 2: Activation Code Schema & Import Summary

Enhanced activation code schema with source tracking and used_at timestamps, updated admin API with user association and never-expire behavior, imported 12,137 legacy codes from text file.

## What Was Done

### Task 1: Schema migration, model update, and API enhancement
- Created migration 072 adding `source` ENUM('generated','imported') and `used_at` DATE columns
- Widened `code` column from VARCHAR(12) to VARCHAR(16) for imported codes with dashes
- Updated ActivationCode model with new fields in interface, class declarations, and init()
- POST handler: codes now get `expires_at: 9999-12-31` and explicit `source: 'generated'`
- GET handler: default limit changed 20 -> 50, includes `usedByUser` association (id, username, display_name), added `source` query filter
- Association `ActivationCode.belongsTo(User, { as: 'usedByUser' })` already existed in models/index.ts

### Task 2: Import old activation codes from legacy text file
- Added `importActivationCodes()` function to import script
- Parses `activation_codes.txt` (format: `19401 - 7216-7538-2454`)
- 12,214 lines parsed, 12,137 unique codes imported, 77 in-file duplicates skipped
- Uses INSERT IGNORE for idempotent re-runs (second run imports 0, skips all)
- Supports `--table=activation_codes` for standalone execution
- Added activation_codes to stats tracking and verification table list

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| f093af3 | feat | Schema migration, model update, and API enhancement |
| aae04d4 | feat | Import old activation codes from legacy text file |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] Migration 072 applied (source, used_at columns, code VARCHAR(16))
- [x] ActivationCode model has source and used_at fields
- [x] API GET returns codes with usedByUser association and source field
- [x] API POST creates codes with never-expire date and source='generated'
- [x] 12,137 old codes imported with source='imported' and dashes preserved
- [x] Import is idempotent (re-run imports 0, skips all as duplicates)
- [x] `npx next build` succeeds

## Next Phase Readiness

Plan 09-03 (Activation Code Admin UI) can proceed. Schema, model, and API are ready with:
- source field for filtering generated vs imported codes
- usedByUser association for displaying redeemer info
- 50 codes per page default
- ~12K imported codes available for display
