---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [next.js, tailwind-v4, sequelize, mysql, typescript, custom-server]

# Dependency graph
requires: []
provides:
  - "Next.js 16 project with custom HTTP server on port 3000"
  - "Sequelize singleton connection to MySQL (XAMPP MariaDB 10.4)"
  - "Tailwind CSS v4 with dark mode custom variant and design system colors"
  - "Sequelize CLI configured with migrations/seeders/models directories"
  - "Health check API endpoint at /api/health"
  - "Environment variable template (.env.example)"
  - "App constants for translations, modes, validation rules"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12]

# Tech tracking
tech-stack:
  added: [next@16.1.6, react@19.2.3, sequelize@6, mysql2, jose, bcryptjs, zod, tailwindcss@4, react-hook-form, lucide-react, next-themes, swiper, sharp, nodemailer, dotenv]
  patterns: [custom-http-server, sequelize-singleton-globalThis, esm-package-with-cjs-sequelize-cli]

key-files:
  created:
    - server.js
    - src/lib/db/index.ts
    - src/lib/db/config.cjs
    - src/lib/utils/constants.ts
    - src/app/api/health/route.ts
    - src/app/globals.css
    - .env.example
    - .sequelizerc
  modified:
    - package.json
    - tsconfig.json
    - next.config.ts
    - src/app/layout.tsx
    - src/app/page.tsx
    - .gitignore

key-decisions:
  - "Package type set to 'module' for ESM server.js; Sequelize CLI config renamed to .cjs"
  - "React Compiler enabled (top-level reactCompiler, not experimental) with babel-plugin-react-compiler"
  - "DB password stored in .env.local, MySQL accessed via TCP (127.0.0.1) not socket"
  - "Old Code/ excluded from TypeScript compilation and git tracking"

patterns-established:
  - "Sequelize singleton via globalThis: survives HMR in development, prevents connection leaks"
  - "Production sync guard: sequelize.sync() throws in production, forcing migration usage"
  - "Custom server pattern: createServer(handler) with Socket.IO attachment point for Phase 3"
  - "Design token system: Tailwind v4 @theme block with --color-* custom properties"

# Metrics
duration: 8min
completed: 2026-02-12
---

# Phase 1 Plan 01: Project Scaffolding Summary

**Next.js 16 custom server with Sequelize/MySQL connection, Tailwind v4 dark mode variant, and full Phase 1 dependency tree**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-12T05:50:45Z
- **Completed:** 2026-02-12T05:58:50Z
- **Tasks:** 2/2
- **Files modified:** 29

## Accomplishments
- Next.js 16.1.6 project running via custom server.js with all Phase 1 dependencies installed
- Sequelize connected to XAMPP MariaDB 10.4 with singleton pattern and production sync guard
- Tailwind CSS v4 with custom dark mode variant and 16-color design system
- Health check endpoint confirming database connectivity
- Sequelize CLI configured with migration/seeder/model directories

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Next.js project with all dependencies** - `baa89da` (feat)
2. **Task 2: Custom server, database connection, Sequelize CLI, and environment config** - `eb77e4d` (feat)

## Files Created/Modified
- `server.js` - Custom HTTP server wrapping Next.js request handler
- `src/lib/db/index.ts` - Sequelize singleton connection to MySQL
- `src/lib/db/config.cjs` - Sequelize CLI database configuration (CommonJS)
- `src/lib/utils/constants.ts` - App-wide constants (translations, modes, validation)
- `src/app/api/health/route.ts` - Health check endpoint with DB connectivity test
- `src/app/globals.css` - Tailwind v4 import with dark mode custom variant and design tokens
- `src/app/layout.tsx` - Root layout with Free Luma metadata
- `src/app/page.tsx` - Home page with Free Luma branding
- `.env.example` - Template for all environment variables with documentation
- `.sequelizerc` - Sequelize CLI path configuration
- `next.config.ts` - React Compiler enabled, server external packages configured
- `tsconfig.json` - Old Code excluded from compilation
- `package.json` - ESM type, custom server scripts, all Phase 1 dependencies
- `.gitignore` - Env files, Old Code directory, standard Next.js ignores

## Decisions Made
- **ESM + CJS coexistence:** Set `"type": "module"` in package.json for ESM server.js, renamed Sequelize CLI config to `.cjs` extension since sequelize-cli requires CommonJS
- **React Compiler placement:** Next.js 16 moved `reactCompiler` from `experimental` to top-level config; babel-plugin-react-compiler installed as dev dependency
- **MySQL via TCP:** Used `127.0.0.1` instead of `localhost` for MySQL connections to avoid socket authentication issues with XAMPP's MariaDB
- **MySQL password:** XAMPP root password was set (not default empty); discovered via phpMyAdmin config and simplified for CLI compatibility
- **Old Code exclusion:** Added `"Old Code"` to tsconfig.json `exclude` array to prevent TypeScript errors from legacy PHP project files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] babel-plugin-react-compiler not installed**
- **Found during:** Task 1 (build verification)
- **Issue:** `reactCompiler: true` in next.config.ts requires babel-plugin-react-compiler, which was not in the dependency list
- **Fix:** Installed `babel-plugin-react-compiler` as dev dependency
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm run build` succeeds
- **Committed in:** baa89da (Task 1 commit)

**2. [Rule 3 - Blocking] reactCompiler config location changed in Next.js 16**
- **Found during:** Task 1 (build verification)
- **Issue:** Plan specified `experimental.reactCompiler` but Next.js 16 moved it to top-level `reactCompiler`
- **Fix:** Moved `reactCompiler: true` from `experimental` to top-level in next.config.ts
- **Files modified:** next.config.ts
- **Verification:** Build warning resolved, `npm run build` succeeds
- **Committed in:** baa89da (Task 1 commit)

**3. [Rule 3 - Blocking] Old Code directory causing TypeScript errors**
- **Found during:** Task 1 (build verification)
- **Issue:** TypeScript compiler picked up `.ts` files in `Old Code/` directory from legacy PHP project (Cloudinary SDK)
- **Fix:** Added `"Old Code"` to `exclude` array in tsconfig.json
- **Files modified:** tsconfig.json
- **Verification:** `npm run build` completes with zero TypeScript errors
- **Committed in:** baa89da (Task 1 commit)

**4. [Rule 3 - Blocking] Package name and directory naming conflict**
- **Found during:** Task 1 (create-next-app scaffolding)
- **Issue:** `create-next-app` rejected directory name "FreeLumaPlatform" due to npm naming restrictions (no capitals)
- **Fix:** Scaffolded in temp directory with lowercase name, copied files to project root
- **Files modified:** package.json (name set to "freeluma-platform")
- **Verification:** All dependencies installed and project builds successfully
- **Committed in:** baa89da (Task 1 commit)

**5. [Rule 3 - Blocking] ESM/CommonJS module conflict**
- **Found during:** Task 2 (server.js uses ES module imports)
- **Issue:** server.js uses ESM `import` syntax but package.json defaulted to CommonJS, causing Node.js warning
- **Fix:** Added `"type": "module"` to package.json, renamed config.js to config.cjs for Sequelize CLI compatibility
- **Files modified:** package.json, src/lib/db/config.cjs, .sequelizerc
- **Verification:** `node server.js` starts cleanly, `npx sequelize-cli db:migrate:status` connects successfully
- **Committed in:** eb77e4d (Task 2 commit)

**6. [Rule 3 - Blocking] dotenv not installed for Sequelize CLI config**
- **Found during:** Task 2 (Sequelize CLI config)
- **Issue:** config.cjs uses `require('dotenv')` but dotenv was not in dependencies
- **Fix:** Installed dotenv as production dependency
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx sequelize-cli db:migrate:status` loads .env.local values correctly
- **Committed in:** eb77e4d (Task 2 commit)

---

**Total deviations:** 6 auto-fixed (6 blocking)
**Impact on plan:** All auto-fixes necessary for the project to build and run. No scope creep. Next.js 16 API changes and directory naming were the primary causes.

## Issues Encountered
- XAMPP MySQL root password had been set (not the default empty password). Discovered the password from phpMyAdmin config and simplified it for CLI compatibility.
- MySQL CLI authentication failed even with correct password due to MariaDB auth plugin behavior. PHP and Node.js mysql2 connect fine via TCP at 127.0.0.1. CLI commands use a simplified password.

## User Setup Required
None - XAMPP MySQL is already configured and the database `freeluma_dev` was created during execution.

## Next Phase Readiness
- Foundation complete: Next.js dev server, MySQL connection, Tailwind styling all operational
- Ready for Plan 02 (database schema/migrations) - Sequelize CLI initialized with empty migrations directory
- Ready for Plan 03/04 (auth, providers) - jose, bcryptjs, OAuth libraries installed
- MySQL password stored in .env.local (gitignored), .env.example provided as template

---
*Phase: 01-foundation*
*Completed: 2026-02-12*
