---
phase: 02-core-social
plan: 03
subsystem: social-graph
tags: [follow, search, hooks, api, social]
completed: 2026-02-12
duration: 4 min
depends_on: [02-01]
provides: [follow-api, user-search, follow-hook, search-hook, follow-button, user-search-result]
affects: [02-04, 02-05, 02-06, 02-07, 02-08]
tech-stack:
  patterns: [optimistic-updates, cursor-pagination, debounced-search, mode-isolation, block-filtering]
key-files:
  created:
    - src/app/api/follows/[userId]/route.ts
    - src/app/api/follows/requests/route.ts
    - src/app/api/follows/suggestions/route.ts
    - src/app/api/users/[id]/followers/route.ts
    - src/app/api/users/[id]/following/route.ts
    - src/app/api/users/search/route.ts
    - src/hooks/useFollow.ts
    - src/hooks/useUserSearch.ts
    - src/components/social/FollowButton.tsx
    - src/components/social/UserSearchResult.tsx
---

# Phase 2 Plan 3: Follow System & User Search Summary

Complete follow/unfollow/request system with user search, hooks, and reusable UI components built on the Follow, Block, and User models from 02-01.

## What Was Built

### Follow System API (5 routes)

**POST/DELETE /api/follows/[userId]** - Follow and unfollow a user. Prevents self-follow, checks blocks (bidirectional), respects mode isolation via PlatformSetting, creates pending status for private profiles and active for public. Delete finds and destroys the Follow row.

**GET/PUT /api/follows/requests** - List pending follow requests (where following_id = me) with cursor pagination and follower User details. PUT accepts { follower_id, action:'accept'|'reject' } to update to active or destroy the row.

**GET /api/follows/suggestions** - Mixed algorithm raw SQL query combining three strategies: popular users by follower count (top 10), interest-based by shared category overlap (top 10), and new users from last 30 days (top 10). Results are deduplicated and limited to 20. Excludes followed, blocked (bidirectional), and self. Respects mode isolation.

**GET /api/users/[id]/followers** and **GET /api/users/[id]/following** - Cursor-paginated lists with privacy enforcement (private profiles only visible to owner), bidirectional block filtering, and User details via association includes.

### User Search API (1 route)

**GET /api/users/search?q=** - Min 2 chars, LIKE search on username and display_name with intelligent ordering (exact match > prefix > contains). Excludes self, blocked users, non-onboarded, deleted. Returns follow_status per result. Mode isolation when enabled.

### Hooks (2 files)

**useFollow** - Manages follow/unfollow toggle for a single user with optimistic updates. POST to follow (corrects to pending from server response for private profiles), DELETE to unfollow. Automatic rollback on error.

**useUserSearch** - 400ms debounced search with min 2 char threshold. AbortController for request cancellation. Returns typed SearchResult[] with follow_status.

### Components (2 files)

**FollowButton** - Three visual states: "Follow" (filled primary), "Following" (outline with hover-to-red), "Requested" (outline muted with clock icon). Unfollow/cancel confirmation resets after 3 seconds. sm/md size variants. Dark mode support.

**UserSearchResult** - Row component with avatar (image or InitialsAvatar), display_name, @username, bio (line-clamped), and inline FollowButton. Entire row links to /profile/[username]. Dark mode hover states.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Raw SQL for suggestions | Three-strategy UNION ALL is cleaner and more performant than multiple Sequelize queries |
| Cursor pagination on Follow.id | Consistent with existing patterns, avoids offset-based pagination issues |
| 3-second unfollow confirm timeout | Prevents accidental unfollows without blocking the UI |
| Bidirectional block check | Both blocker and blocked should not see each other in any list |
| Optimistic follow defaults to 'active' | Server corrects to 'pending' on response for private profiles |

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 088b225 | Follow system API routes (5 files) |
| 2 | 6768080 | User search API + hooks + components (5 files) |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run build` passes with all 8 new API routes registered
- All routes use withAuth HOF pattern
- Zod validation on follow request accept/reject
- All components use cn() and dark mode classes

## Next Phase Readiness

- Follow API ready for "Following" feed tab (02-06)
- FollowButton and UserSearchResult ready for profile pages (02-05) and discover features
- useFollow hook available for any component needing follow state
- Suggestions API ready for onboarding follow step upgrade (replacing Phase 1 placeholders)
