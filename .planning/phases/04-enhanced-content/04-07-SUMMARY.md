---
phase: 04-enhanced-content
plan: 07
subsystem: api
tags: [streaks, activity-tracking, account-stats, timezone, fire-and-forget]

# Dependency graph
requires:
  - phase: 04-02
    provides: ActivityStreak model and migration
provides:
  - trackActivity() utility for recording qualifying daily activities
  - calculateStreak() utility for computing current/longest streaks
  - GET /api/account/stats endpoint with aggregated user statistics
  - Fire-and-forget streak tracking integrated into 7 existing endpoints
affects: [04-frontend, account-page, profile-stats]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget dynamic import pattern for non-blocking tracking"
    - "Timezone-aware daily activity bucketing via getUserLocalDate()"
    - "Parallel Promise.all for aggregated count queries"

key-files:
  created:
    - src/lib/streaks/tracker.ts
    - src/lib/streaks/calculator.ts
    - src/app/api/account/stats/route.ts
  modified:
    - src/app/api/daily-posts/route.ts
    - src/app/api/listen-log/route.ts
    - src/app/api/post-reactions/route.ts
    - src/app/api/post-comments/route.ts
    - src/app/api/posts/route.ts
    - src/app/api/prayer-requests/route.ts
    - src/app/api/prayer-requests/[id]/pray/route.ts

key-decisions:
  - "Fire-and-forget via dynamic import().then().catch() pattern for all trackActivity calls"
  - "Streak calculation uses date Set for O(1) lookup and backward walk from today"
  - "Current streak starts from yesterday if no activity today (graceful same-day gap)"
  - "Video watch tracking skipped per parallel plan note (04-05 creates that route)"

patterns-established:
  - "Dynamic import fire-and-forget: import('module').then(({fn}) => fn().catch(() => {})).catch(() => {})"
  - "Aggregated stats via parallel Promise.all count queries"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 4 Plan 7: Activity Streak Tracking & Account Stats Summary

**Timezone-aware activity streak tracker with calculator utilities and account stats API aggregating posts, followers, reactions, comments, prayers, and streak data**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T06:47:28Z
- **Completed:** 2026-02-14T06:49:56Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Streak tracker records qualifying daily activities per user with timezone-aware day boundaries
- Streak calculator computes current/longest streaks and total active days from ActivityStreak records
- Account stats API returns structured account info, activity counts, and streak data in a single endpoint
- Fire-and-forget tracking integrated into 7 existing endpoints covering daily views, audio listens, and social actions

## Task Commits

Each task was committed atomically:

1. **Task 1: Activity streak tracker and calculator utilities** - `d062e08` (feat)
2. **Task 2: Account stats API + streak tracking integration** - `f6368b5` (feat)

## Files Created/Modified
- `src/lib/streaks/tracker.ts` - trackActivity() with timezone-aware date bucketing and fire-and-forget pattern
- `src/lib/streaks/calculator.ts` - calculateStreak() computing current/longest streaks via date Set lookup
- `src/app/api/account/stats/route.ts` - GET endpoint aggregating account, activity, and streak data
- `src/app/api/daily-posts/route.ts` - Added daily_view tracking for authenticated users
- `src/app/api/listen-log/route.ts` - Added audio_listen tracking when completed
- `src/app/api/post-reactions/route.ts` - Added social_activity tracking on new reaction
- `src/app/api/post-comments/route.ts` - Added social_activity tracking on new comment
- `src/app/api/posts/route.ts` - Added social_activity tracking on new post
- `src/app/api/prayer-requests/route.ts` - Added social_activity tracking on new prayer request
- `src/app/api/prayer-requests/[id]/pray/route.ts` - Added social_activity tracking on pray action

## Decisions Made
- **Fire-and-forget via dynamic import**: Used `import('module').then(({fn}) => fn().catch(() => {})).catch(() => {})` pattern to ensure tracking never blocks or fails the main request
- **Streak start from yesterday**: If no activity recorded today, current streak calculation starts from yesterday to avoid showing 0 mid-day
- **Date Set lookup for O(1)**: Calculator builds a Set of date strings for constant-time consecutive-day checking
- **Video watch tracking deferred**: Skipped video_watch integration per parallel plan note (04-05 creates the route)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Streak tracking infrastructure ready for frontend account stats page
- Video watch tracking can be added when Plan 04-05 route is complete
- All 4 activity types (daily_view, audio_listen, video_watch, social_activity) defined and ready

---
*Phase: 04-enhanced-content*
*Completed: 2026-02-14*
