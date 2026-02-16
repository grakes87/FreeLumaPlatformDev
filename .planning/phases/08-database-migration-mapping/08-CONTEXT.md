# Phase 8: Database Migration Mapping - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Analyze the old platform database (`Old Database/main free luma database.sql`), catalog every table and column, map each to the new FreeLuma schema, document relationships and transformations, and produce an `.xlsx` Excel spreadsheet with the complete mapping and sample data. Workshop tables from the old DB are excluded entirely. This phase produces the mapping deliverable — actual migration scripts are Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Deliverable Format
- **File format:** `.xlsx` Excel file (use exceljs or similar library to generate)
- **Sheet organization:** One sheet per old table, each containing column-by-column mapping
- **Overview sheet:** First sheet is a summary listing all old tables with: mapped/skipped/dropped status, target new table, and row count from old DB
- **Columns per table sheet:** Old Column, Old Type, New Table, New Column, New Type, Transformation Rule, Sample Old Value, Expected New Value, Data Quality Notes
- **Transformation rules** use descriptive verbs: 'rename', 'type cast', 'merge with X', 'split into X+Y', 'compute from...', 'COMPUTED in new schema', etc.

### Unmapped Data Handling
- **No-match tables:** Flag as 'NEEDS DECISION' in spreadsheet with descriptive note — user decides later, nothing auto-dropped
- **Workshop tables:** Exclude entirely from the spreadsheet (rebuilt in Phase 5, not relevant)
- **Computed fields:** Include with 'COMPUTED in new schema — no migration needed' note (don't skip them)
- **All ambiguous cases** get flagged for review — Claude does not unilaterally decide to drop anything

### Sample Data Scope
- **Data source:** Real data extracted from the SQL dump INSERT statements
- **Row count:** 5 sample rows per table to catch edge cases (nulls, different formats, variations)
- **Before/after:** Show both 'Sample Old Value' AND 'Expected New Value' demonstrating the transformation result
- **Table row counts:** Include total row count per old table on the overview sheet for migration volume awareness
- **Data quality notes:** Per-column flagging of issues (mixed formats, unexpected nulls, encoding problems, inconsistencies)

### Relationship Mapping
- **Depth:** Full business logic — explicit FKs + implicit joins (naming convention inference) + application-level relationships
- **Discovery approach:** Claude identifies likely relationships from naming/types, user validates which are real
- **Location:** Inline on each table's sheet (relationship section at bottom of each table sheet)
- **Old-to-new mapping:** Document how old relationships translate to new schema relationships (e.g. column renames, pivot table consolidations)
- **Orphan detection:** Run integrity checks on old SQL dump and flag orphaned records per table
- **Pivot tables:** Get their own sheet like any other table — consistent treatment
- **Data quality:** Flag per column directly in the mapping sheets (not a separate quality report)

### Claude's Discretion
- Exact Excel styling and formatting
- Order of table sheets (alphabetical, dependency-ordered, or domain-grouped)
- How to format the relationship section within each sheet
- Orphan detection methodology

</decisions>

<specifics>
## Specific Ideas

- Old database SQL lives at `Old Database/main free luma database.sql`
- New database models are in `src/lib/db/models/` with migrations in `src/lib/db/migrations/`
- User has no upfront notes about old DB — discover everything fresh from the SQL dump
- The mapping deliverable will feed directly into Phase 7 (Migration & Launch) migration script development

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-database-migration-mapping*
*Context gathered: 2026-02-15*
