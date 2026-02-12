---
phase: 02-core-social
plan: 06
subsystem: feed-system
tags: [api, feed, fyp, following, cursor-pagination, recommendation-algorithm, infinite-scroll, hooks]
depends_on:
  requires: ["02-02", "02-03"]
  provides: ["following-feed-api", "fyp-feed-api", "useFeed-hook", "useInfiniteScroll-hook"]
  affects: ["02-07", "02-09", "02-10"]
tech-stack:
  added: []
  patterns: ["application-level-scoring", "compound-cursor-pagination", "batch-lookup", "sentinel-intersection-observer"]
key-files:
  created:
    - src/app/api/feed/route.ts
    - src/app/api/feed/fyp/route.ts
    - src/hooks/useFeed.ts
    - src/hooks/useInfiniteScroll.ts
  modified: []
decisions:
  - id: fyp-application-scoring
    decision: "FYP recommendation uses application-level scoring on a 200-post candidate pool from last 7 days"
    reason: "SQL-only scoring would require complex JOINs for relationship/interaction signals; app-level is more flexible and maintainable"
  - id: fyp-compound-cursor
    decision: "FYP uses score+id compound cursor instead of created_at+id"
    reason: "Posts are sorted by computed score not chronologically; score-based cursor maintains correct pagination position"
  - id: feed-batch-lookup
    decision: "User reactions and bookmarks fetched via batch lookup after post IDs known (not JOINed)"
    reason: "Separate queries are simpler, avoid N+1, and keep the main query clean"
  - id: default-fyp-tab
    decision: "useFeed defaults to 'fyp' tab"
    reason: "Product context specifies FYP as default discovery surface"
metrics:
  duration: 5 min
  completed: 2026-02-12
---

# Phase 2 Plan 6: Feed API (Following + FYP) Summary

**Two feed endpoints with recommendation algorithm, cursor pagination, and client hooks for infinite scroll.**

## What Was Built

### Following Feed (GET /api/feed)
- Returns posts from followed users + own posts
- Excludes prayer_request type (prayer wall only), blocked users, soft-deleted posts
- Visibility-aware: public posts + followers-only from followed users
- Mode isolation when platform setting enabled
- Cursor pagination on (created_at DESC, id DESC)
- Enriched response: author, media, reaction/comment/repost counts, user reaction, bookmark status
- Quote repost original post data embedded inline (with [deleted] handling)

### FYP Feed (GET /api/feed/fyp)
- Recommendation algorithm with weighted scoring:
  - 0.4 recency (exponential decay: 1/(1 + hours/24))
  - 0.3 engagement (normalized: reactions*1 + comments*2 + reposts*3)
  - 0.2 relationship (followed +0.3, FOF +0.1, interacted authors +0.2)
  - 0.1 category match (overlapping user categories)
- Candidate pool: 200 most recent public posts from last 7 days
- Application-level scoring for flexibility
- Score+id compound cursor for stable pagination
- Same enrichment as Following feed

### useFeed Hook
- FYP/Following tab state management
- Cursor-based pagination with fetchNextPage()
- Pull-to-refresh via refresh()
- Tab switching resets state and fetches from correct endpoint
- Stale response guard (rejects data from wrong tab after switch)
- Deduplication guard (prevents duplicate posts across pages)
- removePost() and updatePost() for local optimistic mutations

### useInfiniteScroll Hook
- Wraps react-intersection-observer useInView
- 200px rootMargin for pre-fetching before sentinel visible
- Returns { ref, inView } for consumer to wire up

## Deviations from Plan

None - plan executed exactly as written. Feed API routes were already committed (98c024d) from a prior session; hooks were the new work committed in this execution.

## Verification

- TypeScript compilation: zero errors
- Following feed correctly filters by followed users, excludes prayer_request
- FYP scoring uses all four signals (recency, engagement, relationship, category)
- Cursor pagination stable with compound cursors
- Block exclusion via getBlockedUserIds utility
- Mode isolation conditional on PlatformSetting

## Next Phase Readiness

Feed endpoints and hooks are ready for:
- Feed UI components (02-07): PostCard, FeedTabs, feed page layout
- Profile pages (02-09): can reuse feed enrichment pattern
- Any component needing infinite scroll can import useInfiniteScroll
