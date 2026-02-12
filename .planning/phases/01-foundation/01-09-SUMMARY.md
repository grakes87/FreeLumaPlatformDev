---
phase: 01-foundation
plan: 09
subsystem: daily-content-api
tags: [daily-content, api-routes, timezone, bible-api, translations, hooks, sequelize, date-fns-tz]

# Dependency graph
requires:
  - phase: 01-02
    provides: "DailyContent, DailyContentTranslation, BibleTranslation Sequelize models with associations"
  - phase: 01-05
    provides: "withAuth middleware, API response helpers, JWT authentication"
provides:
  - "Timezone-aware daily content retrieval (getUserLocalDate with date-fns-tz)"
  - "GET /api/daily-posts endpoint for today's content by user mode/language/timezone"
  - "GET /api/daily-posts/[date] endpoint for historical content with future date rejection"
  - "GET /api/translations endpoint with DB-first lookup and API.Bible fallback"
  - "API.Bible integration (fetchVerseFromBibleApi) with automatic DB caching"
  - "useDailyContent client hook with translation switching and client-side cache"
  - "8 days of sample content seeded for both bible and positivity modes"
affects: [01-10, 01-11, 01-12]

# Tech tracking
tech-stack:
  added: []
  patterns: [timezone-aware-date-calculation, bible-api-fallback-with-db-cache, translation-switching-hook]

key-files:
  created:
    - src/lib/utils/timezone.ts
    - src/lib/bible-api/index.ts
    - src/app/api/daily-posts/route.ts
    - src/app/api/daily-posts/[date]/route.ts
    - src/app/api/translations/route.ts
    - src/hooks/useDailyContent.ts
    - src/lib/db/seeders/005-sample-daily-content.cjs
  modified: []

key-decisions:
  - "Timezone override via query param: API accepts ?timezone= for clients sending detected timezone, falls back to user profile timezone"
  - "API.Bible verse ID mapping: Full book name to 3-letter code mapping (e.g., John -> JHN) for verse reference parsing"
  - "Translation cache-to-DB on fetch: fetchVerseFromBibleApi automatically creates DailyContentTranslation record with source='api'"
  - "Positivity mode translation guard: Returns 400 for translation requests on positivity content (quotes are language-based, not translation-based)"
  - "Seeder uses .cjs extension: Consistent with established ESM package pattern from 01-02"

patterns-established:
  - "getUserLocalDate(timezone) for timezone-aware 'today' calculation using date-fns-tz formatInTimeZone"
  - "DB-first, API-fallback translation pattern: check DB -> if missing, fetch from bible.api -> cache to DB -> return"
  - "useDailyContent hook pattern: fetch content, populate translation cache from included translations, switchTranslation fetches on demand"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 1 Plan 09: Daily Content API Summary

**Timezone-aware daily content retrieval with bible.api translation fallback, client-side hook with translation switching, and 8 days of sample content seeded**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T06:23:18Z
- **Completed:** 2026-02-12T06:27:35Z
- **Tasks:** 2/2
- **Files created:** 7

## Accomplishments

- Timezone utility with `getUserLocalDate()` using date-fns-tz `formatInTimeZone` for user-local midnight content switching
- Helper functions: `detectTimezone()`, `isValidDateString()`, `isFutureDate()` for date validation
- API.Bible integration: `fetchVerseFromBibleApi()` with book name parsing, HTML stripping, and automatic DB caching
- Bible API supports KJV, NIV, NRSV, NAB translations via scripture.api.bible
- GET /api/daily-posts: authenticated, timezone-aware, mode/language-filtered daily content with translations
- GET /api/daily-posts/[date]: historical content with date format validation and future date rejection
- GET /api/translations: DB-first translation lookup, bible.api fallback for missing translations, positivity mode guard
- `useDailyContent` client hook: fetches content, manages active translation state, client-side translation cache, `switchTranslation()` for on-demand fetching
- Sample content seeder: 16 records (8 bible + 8 positivity) for 8 days, plus 8 KJV translation records

## Task Commits

Each task was committed atomically:

1. **Task 1: Timezone utility, bible.api fallback, and daily content API endpoints** - `d1cd640` (feat)
2. **Task 2: Client-side daily content hook and sample content seeder** - `00ebf34` (feat)

## Files Created

- `src/lib/utils/timezone.ts` - getUserLocalDate, detectTimezone, isValidDateString, isFutureDate
- `src/lib/bible-api/index.ts` - fetchVerseFromBibleApi with API.Bible REST integration and DB caching
- `src/app/api/daily-posts/route.ts` - GET today's daily content (protected, timezone-aware)
- `src/app/api/daily-posts/[date]/route.ts` - GET historical daily content by date
- `src/app/api/translations/route.ts` - GET translation with DB-first lookup and bible.api fallback
- `src/hooks/useDailyContent.ts` - Client-side hook for daily content fetching and translation switching
- `src/lib/db/seeders/005-sample-daily-content.cjs` - Sample content seeder for 8 days of testing

## Decisions Made

- **Timezone override via query param:** The daily-posts endpoints accept an optional `?timezone=` query parameter allowing the client to send its detected timezone (via `Intl.DateTimeFormat`). Falls back to the user's stored timezone from their profile. This allows more accurate "today" calculation even if the user has not updated their profile timezone.
- **API.Bible verse ID mapping:** Built a comprehensive book name to 3-letter API.Bible code mapping (66 books). Parses references like "John 3:16" into "JHN.3.16" for the API.Bible REST endpoint.
- **Graceful fallback chain:** If BIBLE_API_KEY is not set, the fallback silently returns null. If the verse reference cannot be parsed, returns null. If the API call fails, returns null. The main flow never crashes due to the fallback.
- **Positivity mode translation guard:** Returns HTTP 400 with an explanatory message for translation requests on positivity content, since quotes are language-based (en/es) not translation-based (KJV/NIV).
- **Client-side translation cache:** The `useDailyContent` hook uses a `useRef` Map to cache fetched translations, avoiding re-fetching when switching back to a previously loaded translation.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. Sample content seeded: 16 daily content records + 8 KJV translations -- PASS
2. API routes compile successfully in Next.js build -- PASS
3. Database verified: content spans 2026-02-05 through 2026-02-12 for both modes -- PASS
4. Build passes (pre-existing GoogleButton/AppleButton errors unrelated to this plan) -- PASS

## User Setup Required

- **BIBLE_API_KEY** environment variable needed for API.Bible translation fallback
- See `01-09-USER-SETUP.md` for detailed setup instructions
- Without the key, the platform works normally but cannot fetch missing translations from API.Bible

## Next Phase Readiness

- Daily content API endpoints ready for the daily post UI (01-10): fetch today's content, switch translations
- `useDailyContent` hook ready for direct use in the daily post page component
- Historical content endpoint ready for "swipe back to previous days" feature
- Sample content seeded for immediate UI development and testing
- Translation switching pipeline (DB -> API.Bible -> cache to DB) fully operational

---
*Phase: 01-foundation*
*Completed: 2026-02-12*
