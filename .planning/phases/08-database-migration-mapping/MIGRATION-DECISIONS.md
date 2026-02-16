# Migration Mapping Decisions

All decisions made during Phase 8 spreadsheet review. Reference this when building the migration script.

## Tables Being Imported (11)

| Old Table | New Table(s) | Rows | Key Notes |
|-----------|-------------|------|-----------|
| users | users + user_settings | 31,627 | Split profile/preferences. Add phone column. |
| categories | categories | 2 | 1:1 mapping (BIBLE, POSITIVITY) |
| category_user_relations | user_categories | 44,631 | Simple rename |
| posts | posts + post_media + prayer_requests | 1,207 | Skip soft-deleted. Type split FEED/PRAYER_WALL. |
| comments | post_comments | 872 | Skip soft-deleted. parent_id 0 -> NULL. |
| usercomments | post_comment_reactions | 494 | is_liked=1 -> reaction_type='love' |
| follows | follows | 1,192 | status: 1->active, 0->pending |
| chats | conversations + conversation_participants + messages + message_media + message_status | 284 | Complex structural transform. Flat -> grouped. |
| dailypostcomments | daily_comments | 4,586 | Skip soft-deleted. daily_post_id -> daily_content_id via date lookup. |
| dailypostusers | daily_reactions + bookmarks | 23,685 | DUAL SPLIT: is_liked=1 -> love reaction, is_bookmarked=1 -> bookmark |
| dailypostusercomments | daily_comment_reactions (NEW TABLE) | 6,733 | Heart-only reactions. Only import is_liked=1. |

## Tables Skipped (8)

| Old Table | Rows | Reason |
|-----------|------|--------|
| settings | 2 | Old platform config (UNDER_AGE_LIMIT, TILES_HIDE_FOR_GUEST) not needed |
| subscribewebpushes | 78 | Push subscriptions invalid on new domain |
| homescreen_tile_categories | 10 | Old UI layout, not carried over |
| verses | 3,403 | Superseded by daily_content.verse_reference |
| verse_comments | 42 | Superseded by daily_comments |
| verse_likes | 3,716 | Superseded by daily_reactions |
| verse_user_comments | 1 | Only 1 row, not needed |
| notes | 68 | Personal journal entries, no equivalent in new app |
| notifications | 28,394 | Start fresh, complex transform not worth it |

## Already Migrated (4)

| Old Table | New Table | Notes |
|-----------|-----------|-------|
| dailyposts | daily_content | Content migrated separately |
| dailychapters | listen_logs | Listen progress migrated separately |
| uservideos | videos | Videos handled differently, already imported |
| uservideorelations | video_progress | Already imported with uservideos |

## Excluded (5 workshop tables)

workshops, workshop_series, workshop_interests, workshop_invitations, workshoplogs — rebuilt from scratch in Phase 5.

---

## User Decisions (by question number)

### Q1: users.phone
**Decision:** Add `phone` column to new users table (new migration needed). Import existing values, NULL for users without.

### Q2: bookmark_setting vs bible_setting
**Decision:** Use `bible_setting` -> `preferred_translation`. Drop `bookmark_setting`.

### Q3: tile_category, top_slide_preference, comment_hidden
**Decision:** Drop all three. Old UI settings not needed.

### Q4: Plaintext passwords
**Decision:** Hash with bcrypt during import. Users with `$2y$` prefix get `$2b$` swap (seamless). Plaintext passwords get hashed. All users log in unchanged.

### Q5: Test accounts (IDs <= ~85)
**Decision:** Import but set `status='deactivated'`.

### Q6: liked_posts JSON
**Decision:** Import into `post_reactions` as `reaction_type='love'`. Only 3 users have data (157 total likes). All IDs valid.

### Q7: cover_media
**Decision:** Drop. Was just display ordering for media carousel.

### Q8: Soft-deleted posts
**Decision:** Skip entirely (do not import is_deleted=1 rows).

### Q9: Soft-deleted comments
**Decision:** Skip entirely (do not import is_deleted=1 rows).

### Q10: Notes (68 rows)
**Decision:** Skip. No personal notes feature in new app.

### Q11: Notifications (28K rows)
**Decision:** Skip. Start fresh.

### Q12: Chats (284 messages)
**Decision:** Import with full structural transformation (flat -> conversations + participants + messages + message_media + message_status).

### Q13: Web push subscriptions
**Decision:** Skip. Invalid on new domain/service worker.

### Q14: Settings (2 rows)
**Decision:** Skip. UNDER_AGE_LIMIT and TILES_HIDE_FOR_GUEST not needed.

### Q15: dailypostusercomments (comment likes)
**Decision:** Create NEW `daily_comment_reactions` table. Heart-only (no reaction_type enum). Only import is_liked=1 rows.

### Q16: Videos (uservideos + uservideorelations)
**Decision:** Already imported. Mark as ALREADY MIGRATED.

### Q17: Chat message model corrections
**Decision:** Fixed mapping errors:
- `chats.message` -> `messages.content` (not body)
- `chats.media` -> `message_media` table (not a column on messages)
- `chats.message_type`: TEXT->'text', IMAGE/VIDEO->'media', AUDIO->'voice'
- `chats.is_seen` -> `message_status` table (status='delivered'/'read')
- `conversation_participants.last_read_at` derived from latest is_seen=1 timestamp

### Q18: preferred_translation FLP value
**Decision:** Map `FLP` -> `'KJV'` (FLP no longer available). NIRV and all others direct copy.

### Q19: Post comment reaction type
**Decision:** `reaction_type='love'` (heart). Consistent with daily content convention.

### Q20: HTML in posts.text_content
**Decision:** Strip to plain text. Decode HTML entities.

### Q21: Media files (profile, posts, chats)
**Decision:** Import local filenames as-is during data migration. POST-MIGRATION: separate script uploads files to B2 and updates URLs in database. Three areas: users.avatar_url, post_media.media_url, message_media.media_url.

### Q22: users.is_admin
**Decision:** Don't touch. Existing admin user already set up. No imported users are admin.

---

## New Schema Changes Needed

1. **`users.phone`** — Add VARCHAR(20) nullable column (new migration)
2. **`daily_comment_reactions`** — Create new table (new migration):
   - id (INTEGER AUTO_INCREMENT PK)
   - comment_id (INTEGER FK -> daily_comments.id)
   - user_id (INTEGER FK -> users.id)
   - created_at (DATE)
   - updated_at (DATE)
   - Heart-only reactions — no reaction_type column needed

## Post-Migration Steps

1. **B2 Media Upload Script** — Scan local files, upload to Backblaze B2, update URLs:
   - `users.avatar_url` (profile pictures)
   - `post_media.media_url` (post images/videos)
   - `message_media.media_url` (chat media)

## Key Transformation Rules

- **Passwords:** `$2y$` -> `$2b$` prefix swap; plaintext -> bcrypt hash
- **parent_id:** Convert 0 -> NULL (root comments) in both post_comments and daily_comments
- **Soft deletes:** Filter out is_deleted=1 rows (posts, comments, dailypostcomments)
- **Test accounts:** user IDs <= ~85 -> status='deactivated'
- **bible_setting:** FLP -> 'KJV', all others direct copy
- **Reactions:** All old binary likes import as reaction_type='love' (heart) across: post_reactions, post_comment_reactions, daily_reactions
- **Daily content ID resolution:** old dailyposts.id -> dailyposts.daily_post_name (date) -> daily_content.post_date -> daily_content.id
- **Chat restructuring:** Group by min(sender,receiver),max(sender,receiver) -> conversations + 2 participants per pair + messages + media + status

---

*Generated: 2026-02-15*
*Source: Phase 8 spreadsheet review session*
*Spreadsheet: migration-mapping.xlsx (project root)*
