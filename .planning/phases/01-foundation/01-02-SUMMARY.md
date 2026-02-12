---
phase: 01-foundation
plan: 02
subsystem: database
tags: [sequelize, mysql, migrations, seeders, typescript, orm, mariadb]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Sequelize singleton connection, CLI config, project scaffolding"
provides:
  - "9 Sequelize models with TypeScript interfaces and associations"
  - "CLI migrations for all 9 database tables with indexes and constraints"
  - "Seeders for Bible translations, categories, admin user, and activation codes"
  - "Model registry with all associations (hasMany, belongsTo, hasOne)"
affects: [01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12]

# Tech tracking
tech-stack:
  added: []
  patterns: [sequelize-model-typescript-generics, cli-migration-cjs-for-esm, model-registry-associations]

key-files:
  created:
    - src/lib/db/models/User.ts
    - src/lib/db/models/ActivationCode.ts
    - src/lib/db/models/DailyContent.ts
    - src/lib/db/models/DailyContentTranslation.ts
    - src/lib/db/models/BibleTranslation.ts
    - src/lib/db/models/Category.ts
    - src/lib/db/models/UserCategory.ts
    - src/lib/db/models/UserSetting.ts
    - src/lib/db/models/PushSubscription.ts
    - src/lib/db/models/index.ts
    - src/lib/db/migrations/001-create-users.cjs
    - src/lib/db/migrations/002-create-activation-codes.cjs
    - src/lib/db/migrations/003-create-categories.cjs
    - src/lib/db/migrations/004-create-user-categories.cjs
    - src/lib/db/migrations/005-create-daily-content.cjs
    - src/lib/db/migrations/006-create-daily-content-translations.cjs
    - src/lib/db/migrations/007-create-bible-translations.cjs
    - src/lib/db/migrations/008-create-user-settings.cjs
    - src/lib/db/migrations/009-create-push-subscriptions.cjs
    - src/lib/db/seeders/001-bible-translations.cjs
    - src/lib/db/seeders/002-categories.cjs
    - src/lib/db/seeders/003-admin-user.cjs
    - src/lib/db/seeders/004-sample-activation-codes.cjs
  modified: []

key-decisions:
  - "Migration and seeder files use .cjs extension for ESM package compatibility (package.json type: module)"
  - "Admin user password hashed with bcryptjs at salt rounds 12 for dev environment"
  - "ActivationCode has two FK associations to User: used_by (SET NULL) and created_by (SET NULL)"
  - "user_categories and user_settings CASCADE on user delete; activation_codes SET NULL on user delete"
  - "DailyContent composite unique constraint on [post_date, mode, language] prevents duplicate daily posts"

patterns-established:
  - "Sequelize TypeScript model pattern: interface Attributes + interface CreationAttributes + declare fields + Model.init()"
  - "Model registry pattern: import all models, define associations, export together with sequelize instance"
  - "Migration .cjs extension: All Sequelize CLI files must use .cjs in this ESM project"
  - "Seeder ordering: Bible translations and categories first, then user (which may reference categories), then activation codes"

# Metrics
duration: 5min
completed: 2026-02-12
---

# Phase 1 Plan 02: Database Schema & Models Summary

**9 Sequelize models with TypeScript types, CLI migrations for all tables, and seeders for Bible translations, categories, admin user, and activation codes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-12T06:02:51Z
- **Completed:** 2026-02-12T06:08:30Z
- **Tasks:** 2/2
- **Files modified:** 23

## Accomplishments
- All 9 Sequelize models with full TypeScript interfaces (attributes and creation attributes)
- Complete association graph: User hasMany PushSubscription/UserCategory/ActivationCode, hasOne UserSetting; Category hasMany UserCategory; DailyContent hasMany DailyContentTranslation
- 9 CLI migrations creating tables with foreign keys, indexes, and composite unique constraints
- 4 seeders populating Bible translations (KJV, NIV, NRSV, NAB), 6 categories, admin user with settings, and 10 sample activation codes
- Migrations verified fully reversible (undo:all + re-migrate + re-seed)
- Foreign key cascading verified (delete user cascades to user_settings)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create all Sequelize models with TypeScript types** - `5c292d6` (feat)
2. **Task 2: Create Sequelize CLI migrations and seeders** - `8f75acc` (feat)

## Files Created/Modified
- `src/lib/db/models/User.ts` - User model with auth, profile, preference, and admin fields; paranoid soft delete
- `src/lib/db/models/ActivationCode.ts` - Invite-only activation code model with used_by and created_by FKs
- `src/lib/db/models/DailyContent.ts` - Daily post model with video/audio URLs and composite unique constraint
- `src/lib/db/models/DailyContentTranslation.ts` - Bible translation variants per daily content post
- `src/lib/db/models/BibleTranslation.ts` - Supported Bible translation metadata and attribution
- `src/lib/db/models/Category.ts` - Admin-defined content categories with slug and sort order
- `src/lib/db/models/UserCategory.ts` - Many-to-many join table for user interest categories
- `src/lib/db/models/UserSetting.ts` - User preferences (dark mode, notifications, quiet hours)
- `src/lib/db/models/PushSubscription.ts` - Web push subscription endpoints per user
- `src/lib/db/models/index.ts` - Model registry with all associations defined and exported
- `src/lib/db/migrations/001-009` - 9 migration files creating all tables with FK constraints and indexes
- `src/lib/db/seeders/001-004` - 4 seeder files for initial data population

## Decisions Made
- **Migration/seeder file extension:** Used `.cjs` extension because the project has `"type": "module"` in package.json, and Sequelize CLI requires CommonJS format. This matches the pattern established in 01-01 for `config.cjs`.
- **FK cascade strategy:** user_categories, user_settings, push_subscriptions, and daily_content_translations use CASCADE on delete (removing user/content removes related records). activation_codes use SET NULL on delete (preserve code records even if user is deleted).
- **Admin password hashing:** Used bcryptjs with 12 salt rounds for the seeder admin user. Password is "AdminDev123!" for development only.
- **Dual ActivationCode associations:** Two separate hasMany relationships from User to ActivationCode (via used_by and created_by), with distinct aliases "usedCodes" and "createdCodes".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration and seeder files required .cjs extension**
- **Found during:** Task 2 (running migrations)
- **Issue:** Migration .js files failed with "module is not defined in ES module scope" because package.json has `"type": "module"` making all .js files ESM, but Sequelize CLI migrations use `module.exports` (CommonJS)
- **Fix:** Renamed all migration files from .js to .cjs and all seeder files from .js to .cjs
- **Files modified:** All 9 migration files, all 4 seeder files
- **Verification:** `npx sequelize-cli db:migrate` runs all 9 migrations successfully
- **Committed in:** 8f75acc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Expected issue given ESM package setup from 01-01. Same pattern as config.cjs. No scope creep.

## Issues Encountered
- Database authentication required loading .env.local for the test script (model sync verification). The Sequelize CLI config already handles this via dotenv, but standalone scripts need explicit env loading.

## User Setup Required
None - database was already configured in 01-01. Migrations and seeders run automatically with `npx sequelize-cli db:migrate && npx sequelize-cli db:seed:all`.

## Next Phase Readiness
- All database models ready for auth system (01-03): User, ActivationCode models available
- All database models ready for daily content (01-05+): DailyContent, DailyContentTranslation, BibleTranslation models available
- All database models ready for profile/settings (01-07+): UserSetting, UserCategory, Category models available
- No sequelize.sync() used anywhere -- all tables created via CLI migrations as required
- Admin user seeded for testing auth and admin features in subsequent plans

---
*Phase: 01-foundation*
*Completed: 2026-02-12*
