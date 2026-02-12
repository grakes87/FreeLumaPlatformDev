---
phase: 02-core-social
plan: 02
subsystem: social-api
tags: [profanity, blocks, cursor-pagination, mentions, posts, crud, presigned-upload]
depends_on:
  requires: ["02-01"]
  provides: ["post-crud-api", "profanity-filter", "block-helper", "cursor-pagination", "mention-parsing", "post-media-upload"]
  affects: ["02-03", "02-04", "02-05", "02-06", "02-07", "02-08", "02-09", "02-10"]
tech-stack:
  added: []
  patterns: ["profanity-check-and-flag", "bi-directional-block-query", "base64url-cursor-pagination", "presigned-upload-post-media"]
key-files:
  created:
    - src/lib/moderation/profanity.ts
    - src/lib/utils/blocks.ts
    - src/lib/utils/cursor.ts
    - src/lib/utils/mentions.ts
    - src/app/api/posts/route.ts
    - src/app/api/posts/[id]/route.ts
    - src/app/api/upload/post-media/route.ts
  modified: []
decisions:
  - id: profanity-asterisk-strategy
    description: "Use asteriskCensorStrategy from obscenity for censored text output"
  - id: anonymous-post-masking
    description: "Anonymous posts return {id:0, username:'anonymous', display_name:'Anonymous'} for non-authors"
  - id: post-body-max-length
    description: "Post body max 5000 characters, validated via Zod schema"
  - id: post-media-max-10
    description: "Maximum 10 media items per post, validated via Zod schema"
metrics:
  duration: 4 min
  completed: 2026-02-12
---

# Phase 2 Plan 2: Shared Utilities & Post CRUD Summary

JWT-authed Post CRUD (create/read/edit/soft-delete) with profanity flagging, block filtering, follower visibility checks, and presigned B2 upload for post media.

## What Was Built

### Task 1: Shared Utility Modules

**Profanity Filter** (`src/lib/moderation/profanity.ts`):
- Uses `obscenity` library with English dataset and recommended transformers (leet-speak, confusables, duplicate chars)
- `containsProfanity(text)` — boolean check
- `censorText(text)` — replace profane words with asterisks
- `checkAndFlag(text)` — combined check returning `{ flagged, censored }` for post creation/editing

**Block Helper** (`src/lib/utils/blocks.ts`):
- `getBlockedUserIds(userId)` — returns Set of user IDs blocked in either direction (blocker or blocked)
- Lazy-imports Block model to avoid circular dependencies

**Cursor Pagination** (`src/lib/utils/cursor.ts`):
- `encodeCursor({ created_at, id })` — base64url-encoded JSON for keyset pagination
- `decodeCursor(cursor)` — decodes with validation, returns null on invalid input

**Mention/Hashtag Parser** (`src/lib/utils/mentions.ts`):
- `parseMentions(text)` — extracts unique @username mentions (3-30 chars, matching User model constraints)
- `parseHashtags(text)` — extracts unique #hashtags (1-50 chars)

### Task 2: Post CRUD API & Media Upload

**POST /api/posts** — Create post:
- withAuth protected
- Zod validation: body (1-5000 chars), post_type, visibility, is_anonymous, prayer_privacy, media array (max 10)
- Fetches user mode for post mode assignment
- Runs profanity checkAndFlag, sets `flagged` on post
- Bulk-creates PostMedia if media provided
- Creates PrayerRequest if post_type is prayer_request
- Returns 201 with full post including user, media, prayerRequest associations

**GET /api/posts/[id]** — Post detail:
- withAuth protected
- Includes user (author), media, prayerRequest associations
- Block check: returns 404 if blocked in either direction
- Visibility check: followers-only posts require active follow relationship
- Aggregates reaction counts per type, comment count
- Includes user's own reaction and bookmark status
- Anonymous masking: non-authors see generic anonymous user info

**PUT /api/posts/[id]** — Edit post:
- withAuth, author-only (no time limit)
- Zod validation for body and/or visibility
- Re-runs profanity check on body changes
- Sets `edited=true` on any change
- Returns updated post with associations

**DELETE /api/posts/[id]** — Soft delete:
- withAuth, author or admin
- Uses Sequelize paranoid mode (sets deleted_at)

**GET /api/upload/post-media** — Presigned upload URL:
- withAuth protected
- Validates contentType (image/jpeg, image/png, image/webp, image/gif, video/mp4)
- Generates key: `posts/{userId}/{timestamp}-{random}.{ext}`
- Returns upload_url, key, public_url
- Returns 503 if B2 not configured (null client pattern)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Asterisk censor strategy | Clear visual indication of censored content without being creative/distracting |
| Anonymous post masking at API level | Prevents author info leaking through any client; non-authors see id:0, username:'anonymous' |
| 5000 char post body limit | Generous enough for prayer requests and testimonies, not so long as to abuse |
| Max 10 media per post | Reasonable multi-image support without enabling abuse |
| No edit time limit | Faith community platform prioritizes correction over immutability |
| Post media key prefix 'posts/' | Separates from 'avatars/' and 'daily-content/' in B2 bucket |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- All 4 utility modules pass `npx tsc --noEmit` cleanly
- All 3 API route files pass TypeScript compilation
- POST /api/posts creates post with media and prayer request support
- GET /api/posts/[id] returns enriched post with reactions, comments, bookmarks
- PUT /api/posts/[id] edits and sets edited=true with profanity re-check
- DELETE /api/posts/[id] soft-deletes via paranoid mode
- Block filtering prevents viewing blocked users' posts
- Profanity checkAndFlag correctly flags and censors

## Next Phase Readiness

Post CRUD API is ready for:
- Feed API (02-03) to list/paginate posts using cursor utilities
- Post reactions API (02-04) to toggle reactions on posts
- Post comments API (02-05) to add/list comments
- Bookmark API to toggle post bookmarks
- Prayer wall to filter prayer_request posts
