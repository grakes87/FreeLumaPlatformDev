---
phase: 02-core-social
plan: 01
subsystem: database
tags: [sequelize, migrations, models, social, typescript]
dependency-graph:
  requires: [01-foundation]
  provides: [social-db-schema, social-models, platform-settings, user-profile-fields]
  affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-09, 02-10, 02-11, 02-12, 02-13, 02-14]
tech-stack:
  added: [obscenity@0.4.6, react-intersection-observer@10.0.2]
  patterns: [paranoid-soft-delete, platform-settings-kv-store, polymorphic-bookmarks]
key-files:
  created:
    - src/lib/db/migrations/016-create-posts.cjs
    - src/lib/db/migrations/017-create-post-media.cjs
    - src/lib/db/migrations/018-create-post-reactions.cjs
    - src/lib/db/migrations/019-create-post-comments.cjs
    - src/lib/db/migrations/020-create-follows.cjs
    - src/lib/db/migrations/021-create-bookmarks.cjs
    - src/lib/db/migrations/022-create-prayer-requests.cjs
    - src/lib/db/migrations/023-create-prayer-supports.cjs
    - src/lib/db/migrations/024-create-reports.cjs
    - src/lib/db/migrations/025-create-blocks.cjs
    - src/lib/db/migrations/026-create-reposts.cjs
    - src/lib/db/migrations/027-create-post-comment-reactions.cjs
    - src/lib/db/migrations/028-create-platform-settings.cjs
    - src/lib/db/migrations/029-create-drafts.cjs
    - src/lib/db/migrations/030-add-profile-fields-to-users.cjs
    - src/lib/db/models/Post.ts
    - src/lib/db/models/PostMedia.ts
    - src/lib/db/models/PostReaction.ts
    - src/lib/db/models/PostComment.ts
    - src/lib/db/models/PostCommentReaction.ts
    - src/lib/db/models/Follow.ts
    - src/lib/db/models/Bookmark.ts
    - src/lib/db/models/PrayerRequest.ts
    - src/lib/db/models/PrayerSupport.ts
    - src/lib/db/models/Report.ts
    - src/lib/db/models/Block.ts
    - src/lib/db/models/Repost.ts
    - src/lib/db/models/PlatformSetting.ts
    - src/lib/db/models/Draft.ts
  modified:
    - src/lib/db/models/User.ts
    - src/lib/db/models/index.ts
    - package.json
    - package-lock.json
decisions:
  - Post uses paranoid soft delete (deleted_at) for content moderation recovery
  - Bookmarks are polymorphic (post_id OR daily_content_id, both nullable) with separate unique indexes
  - PrayerRequest is a 1-to-1 extension of Post (post_type='prayer_request')
  - PlatformSetting uses key-value store with static get/set helpers for easy access
  - Repost links original post_id to a new quote_post_id (which is itself a Post row)
  - Reports have no FK on comment_id (plain INT) to allow flexibility for daily_comments or post_comments
  - Platform settings seeded with 7 defaults in migration (feed_style, mode_isolation, etc.)
metrics:
  duration: 5 min
  completed: 2026-02-12
---

# Phase 2 Plan 1: Database Schema & Models Summary

**15 migrations + 14 models establishing the complete social database foundation with obscenity/intersection-observer deps**

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Install deps + create 15 migrations | ad496f2 | Done |
| 2 | Create 14 models + update index associations | ce749c7 | Done |

## What Was Built

### Database Tables (15 new)
- **posts** - Core social post with soft delete, mode isolation, anonymous posting, flagging
- **post_media** - Multi-media attachments (image/video) with sort order and dimensions
- **post_reactions** - 6 emoji reaction types per user per post (unique constraint)
- **post_comments** - Threaded comments with self-referencing parent_id, flagging support
- **follows** - Follower/following with active/pending status for future request flow
- **bookmarks** - Polymorphic bookmarks for posts and daily content
- **prayer_requests** - Extension of posts with privacy levels, answered status, testimony
- **prayer_supports** - "I'm praying" tracking per user per prayer request
- **reports** - Content moderation reports with 6 reason types and admin review workflow
- **blocks** - Bidirectional user blocking
- **reposts** - Quote repost linking original post to new quote post
- **post_comment_reactions** - Reactions on comments (mirrors post_reactions pattern)
- **platform_settings** - Global key-value platform configuration (7 defaults seeded)
- **drafts** - Draft posts with JSON media_keys and metadata
- **users (altered)** - Added denomination, church, testimony, profile_privacy, location, website

### Sequelize Models (14 new)
All models follow existing pattern: Model.init() with sequelize instance, DataTypes, underscored: true, timestamps: true. Post model includes paranoid: true for soft delete. PlatformSetting includes static get()/set() convenience methods.

### Associations Registered
All 14 new models registered in index.ts with complete bidirectional associations including:
- User -> Post, PostReaction, PostComment, Follow (both directions), Bookmark, PrayerSupport, Report (reporter + reviewer), Block (both directions), Repost, Draft
- Post -> PostMedia, PostReaction, PostComment, Bookmark, PrayerRequest, Report, Repost (original + quote)
- PostComment -> PostComment (self-ref), PostCommentReaction
- PrayerRequest -> PrayerSupport
- DailyContent -> Bookmark

### User Model Extended
Added 6 new profile fields: denomination (VARCHAR 100), church (VARCHAR 200), testimony (TEXT), profile_privacy (ENUM public/private), location (VARCHAR 200), website (VARCHAR 500).

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npm ls obscenity react-intersection-observer` - both installed
- `npx sequelize-cli db:migrate:status` - all 30 migrations "up"
- `SHOW TABLES` - all 27 tables present (15 new + 12 existing)
- `npx tsc --noEmit` - zero TypeScript errors

## Next Phase Readiness

All subsequent Phase 2 plans can proceed. The database schema and model layer is complete. Plans 02-02 through 02-14 can import any model from `@/lib/db/models` and query all social tables.
