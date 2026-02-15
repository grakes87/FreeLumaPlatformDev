---
phase: 06-bug-fixes
plan: 01
subsystem: api
tags: [typescript, sequelize, scroll-snap, b2, cache-control, build]

# Dependency graph
requires:
  - phase: 02-core-social
    provides: API routes with Sequelize toJSON casts
  - phase: 04-enhanced-content
    provides: Daily content feed with scroll snap, B2 upload routes
provides:
  - Clean TypeScript build (zero errors)
  - Guest scroll snap matching authenticated user experience
  - CDN cache headers on all B2 media uploads
affects: [06-bug-fixes, 07-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Double-cast Sequelize toJSON via `as unknown as Record<string, unknown>`"
    - "CacheControl immutable on content-addressed B2 uploads"

key-files:
  created: []
  modified:
    - src/app/api/admin/audit-log/route.ts
    - src/app/api/admin/comments/route.ts
    - src/app/api/admin/moderation/route.ts
    - src/app/api/admin/users/route.ts
    - src/app/api/admin/users/[id]/route.ts
    - src/app/api/admin/posts/route.ts
    - src/app/api/videos/route.ts
    - src/app/api/users/[id]/profile/route.ts
    - src/app/api/prayer-requests/route.ts
    - src/app/api/users/search/route.ts
    - src/app/(app)/layout.tsx
    - src/app/api/upload/post-media/route.ts
    - src/app/api/upload/chat-media/route.ts
    - src/app/api/videos/[id]/process/route.ts
    - src/lib/storage/presign.ts

key-decisions:
  - "Used double-cast `as unknown as Record` pattern for Sequelize toJSON — avoids changing model types"
  - "Applied immutable cache policy to all B2 uploads including presigned URL generation"

patterns-established:
  - "Sequelize toJSON cast: always use `as unknown as Record<string, unknown>` not direct cast"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 6 Plan 01: Build & UX Quick Fixes Summary

**Fix 11 TypeScript build errors via double-cast pattern, restore guest scroll-snap to match authenticated UX, add 1-year immutable CacheControl to all B2 uploads**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-15T06:05:22Z
- **Completed:** 2026-02-15T06:10:47Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments
- Build now passes cleanly with zero TypeScript errors (fixed 11 instances across 10 files)
- Guest daily content scroll snaps identically to authenticated user experience
- All B2 media uploads (posts, chat, video thumbnails, captions, presigned) include CDN cache headers

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix TypeScript build errors** - `48e5f88` (fix)
2. **Task 2: Restore guest scroll snap** - `736829c` (fix)
3. **Task 3: Add Cache-Control to B2 uploads** - `2505650` (perf)

## Files Created/Modified
- `src/app/api/admin/audit-log/route.ts` - Double-cast toJSON
- `src/app/api/admin/comments/route.ts` - Double-cast toJSON
- `src/app/api/admin/moderation/route.ts` - Double-cast toJSON (3 instances)
- `src/app/api/admin/users/route.ts` - Double-cast toJSON (2 instances)
- `src/app/api/admin/users/[id]/route.ts` - Double-cast model instance
- `src/app/api/admin/posts/route.ts` - Double-cast toJSON (2 instances)
- `src/app/api/videos/route.ts` - Double-cast toJSON
- `src/app/api/users/[id]/profile/route.ts` - Double-cast toJSON
- `src/app/api/prayer-requests/route.ts` - Fix spread of unknown type in Op.and clause
- `src/app/api/users/search/route.ts` - Fix order clause typing with any[]
- `src/app/(app)/layout.tsx` - Guest scroll snap container matching AppShellInner
- `src/app/api/upload/post-media/route.ts` - CacheControl on PutObjectCommand
- `src/app/api/upload/chat-media/route.ts` - CacheControl on PutObjectCommand
- `src/app/api/videos/[id]/process/route.ts` - CacheControl on thumbnail and caption uploads
- `src/lib/storage/presign.ts` - CacheControl on presigned URL generation

## Decisions Made
- Used `as unknown as Record<string, unknown>` double-cast pattern instead of modifying Sequelize model types - simpler fix that doesn't risk breaking model inference
- Applied immutable cache policy (1 year) to ALL B2 uploads including presigned URL generation, since all keys are content-addressed (timestamp + random hash)
- Fixed order clause typing with `any[]` instead of complex Sequelize OrderItem types since the values include both literal and string-based orders

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 9 additional toJSON build errors beyond audit-log**
- **Found during:** Task 1 (Fix TypeScript build error in audit-log route)
- **Issue:** Plan only specified audit-log/route.ts line 92, but the same `toJSON() as Record<string, unknown>` pattern appeared in 9 more API routes, all failing the build
- **Fix:** Applied same double-cast pattern to all 9 additional files
- **Files modified:** admin/comments, admin/moderation (3x), admin/users (2x), admin/users/[id], admin/posts (2x), videos, users/[id]/profile
- **Verification:** `npx next build` passes after all fixes
- **Committed in:** 48e5f88

**2. [Rule 1 - Bug] Fixed model instance cast in admin/users/[id]**
- **Found during:** Task 1 (iterative build verification)
- **Issue:** `(user as Record<string, unknown>)` direct cast fails same way as toJSON
- **Fix:** Applied same double-cast pattern
- **Files modified:** src/app/api/admin/users/[id]/route.ts
- **Committed in:** 48e5f88

**3. [Rule 1 - Bug] Fixed spread of unknown type in prayer-requests route**
- **Found during:** Task 1 (iterative build verification)
- **Issue:** `...( Array.isArray(x) ? x : [] )` where x is unknown type - spread requires iterator
- **Fix:** Added `as unknown[]` cast to the conditional result
- **Files modified:** src/app/api/prayer-requests/route.ts
- **Committed in:** 48e5f88

**4. [Rule 1 - Bug] Fixed order clause typing in users/search route**
- **Found during:** Task 1 (iterative build verification)
- **Issue:** `[unknown, string][]` not assignable to Sequelize OrderItem[] - literal + string order items
- **Fix:** Changed type to `any[]` with eslint disable comment
- **Files modified:** src/app/api/users/search/route.ts
- **Committed in:** 48e5f88

**5. [Rule 2 - Missing Critical] Added CacheControl to 4 additional upload locations**
- **Found during:** Task 3 (Add Cache-Control headers to B2 media uploads)
- **Issue:** Plan specified post-media route only; CacheControl missing from chat-media, video processing (2 PutObjectCommands), and presigned URL generation
- **Fix:** Added CacheControl to all 4 additional PutObjectCommand calls
- **Files modified:** chat-media/route.ts, videos/[id]/process/route.ts (2x), presign.ts
- **Committed in:** 2505650

---

**Total deviations:** 5 auto-fixed (4 bug fixes, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness — build would not pass without fixing all instances, and cache headers must be consistent across all upload paths. No scope creep.

## Issues Encountered
- Build had 4 rounds of failures requiring iterative fix-build-check cycles (each round revealed the next error that was previously hidden by the first)
- The same toJSON cast pattern was used across 10 files but only one was identified in planning research

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Build passes cleanly for deployment
- Guest and authenticated scroll snap behavior now match
- CDN caching enabled for all uploaded media

---
*Phase: 06-bug-fixes*
*Completed: 2026-02-14*
