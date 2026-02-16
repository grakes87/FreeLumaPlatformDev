# Migration Mapping Decisions

All decisions made during Phase 8 spreadsheet review (3 rounds). Reference this when building the migration script.

## Pre-Migration Steps

### 1. Wipe Existing Seed Data
**KEEP (do not touch):**
- `daily_content`
- `daily_content_translations`
- `videos`
- `video_categories`
- `video_reactions`

**WIPE (truncate before import):**
- All other tables: users, posts, post_comments, post_reactions, post_comment_reactions, post_media, prayer_requests, follows, conversations, conversation_participants, messages, message_media, message_status, daily_comments, daily_reactions, bookmarks, user_categories, categories, user_settings, etc.

### 2. Import Order
1. Import all old users with **original IDs** (no offset)
2. After import, seed admin (`admin@freeluma.com`) and testuser (`testuser@freeluma.com`) at IDs after max imported ID (31,627+)

---

## Tables Being Imported (9)

| Old Table | New Table(s) | Rows | Key Notes |
|-----------|-------------|------|-----------|
| users | users + user_settings | 31,627 | Split profile/preferences. Add phone column. Skip 14 users with username > 30 chars. |
| posts | posts + post_media + prayer_requests | 1,207 | Skip soft-deleted. Type split FEED/PRAYER_WALL. Visibility defaults to 'public'. |
| comments | post_comments | 872 | Skip soft-deleted. parent_id 0 -> NULL. |
| usercomments | post_comment_reactions | 494 | is_liked=1 -> reaction_type='love' |
| follows | follows | 1,192 | status: 1->active, 0->pending |
| chats | conversations + conversation_participants + messages + message_media + message_status | 284 | Complex structural transform. Flat -> grouped. |
| dailypostcomments | daily_comments | 4,586 | Skip soft-deleted. daily_post_id -> daily_content_id via date lookup. |
| dailypostusers | daily_reactions + bookmarks | 23,685 | DUAL SPLIT: is_liked=1 -> love reaction, is_bookmarked=1 -> bookmark |
| dailypostusercomments | daily_comment_reactions (NEW TABLE) | 6,733 | Heart-only reactions. Only import is_liked=1. |

## Tables Skipped (10)

| Old Table | Rows | Reason |
|-----------|------|--------|
| categories | 2 | Bible/Positivity now handled by users.mode enum, not categories table |
| category_user_relations | 44,631 | Used only to derive users.mode field, not imported as user_categories |
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

### Round 1 (Q1-Q22): Initial spreadsheet review

#### Q1: users.phone
**Decision:** Add `phone` column to new users table (new migration needed). Import existing values, NULL for users without.

#### Q2: bookmark_setting vs bible_setting
**Decision:** Use `bible_setting` -> `preferred_translation`. Drop `bookmark_setting`.

#### Q3: tile_category, top_slide_preference, comment_hidden
**Decision:** Drop all three. Old UI settings not needed.

#### Q4: Plaintext passwords
**Decision:** Hash with bcrypt during import. Users with `$2y$` prefix get `$2b$` swap (seamless). Plaintext passwords get hashed. All users log in unchanged.

#### Q5: Test accounts (IDs 1-85)
**Decision:** Import but set `status='deactivated'`. ID 86 (`freeluma` / `info@freeluma.com`) stays active.

#### Q6: liked_posts JSON
**Decision:** Import into `post_reactions` as `reaction_type='love'`. Only 3 users have data (157 total likes). All IDs valid. Unique constraint on (user_id, post_id).

#### Q7: cover_media
**Decision:** Drop. Was just display ordering for media carousel.

#### Q8: Soft-deleted posts
**Decision:** Skip entirely (do not import is_deleted=1 rows).

#### Q9: Soft-deleted comments
**Decision:** Skip entirely (do not import is_deleted=1 rows).

#### Q10: Notes (68 rows)
**Decision:** Skip. No personal notes feature in new app.

#### Q11: Notifications (28K rows)
**Decision:** Skip. Start fresh.

#### Q12: Chats (284 messages)
**Decision:** Import with full structural transformation (flat -> conversations + participants + messages + message_media + message_status).

#### Q13: Web push subscriptions
**Decision:** Skip. Invalid on new domain/service worker.

#### Q14: Settings (2 rows)
**Decision:** Skip. UNDER_AGE_LIMIT and TILES_HIDE_FOR_GUEST not needed.

#### Q15: dailypostusercomments (comment likes)
**Decision:** Create NEW `daily_comment_reactions` table. Heart-only (no reaction_type enum). Only import is_liked=1 rows.

#### Q16: Videos (uservideos + uservideorelations)
**Decision:** Already imported. Mark as ALREADY MIGRATED.

#### Q17: Chat message model corrections
**Decision:** Fixed mapping errors:
- `chats.message` -> `messages.content` (not body)
- `chats.media` -> `message_media` table (not a column on messages)
- `chats.message_type`: TEXT->'text', IMAGE/VIDEO->'media', AUDIO->'voice'
- `chats.is_seen` -> `message_status` table (status='delivered'/'read')
- `conversation_participants.last_read_at` derived from latest is_seen=1 timestamp

#### Q18: preferred_translation FLP value
**Decision:** Map `FLP` -> `'KJV'` (FLP no longer available). NIRV and all others direct copy.

#### Q19: Post comment reaction type
**Decision:** `reaction_type='love'` (heart). Consistent with daily content convention.

#### Q20: HTML in posts.text_content
**Decision:** Strip to plain text. Decode HTML entities.

#### Q21: Media files (profile, posts, chats)
**Decision:** Import local filenames as-is during data migration. POST-MIGRATION: separate script uploads files to B2 and updates URLs in database. Three areas: users.avatar_url, post_media.url, message_media.media_url.

#### Q22: users.is_admin
**Decision:** Don't touch. Admin and testuser re-seeded after import at IDs above max imported user.

### Round 2 (Q1-Q5): Model cross-check corrections

These were mapping documentation errors found by comparing the script against actual Sequelize models. No user decisions needed — just fixes.

- PostMedia column is `url` not `media_url`
- Chat mapping fixed to use message_media/message_status tables
- Prayer request uses privacy enum, not is_anonymous
- FLP -> KJV translation mapping
- Post comment reactions use 'love' consistently

### Round 3 (Q1-Q22): Final data quality review

#### Q1: PostMedia column name
**Decision:** Fixed `media_url` -> `url` in mapping. PostMedia also has thumbnail_url, width, height, duration, sort_order — all default to NULL/0 on import.

#### Q2: Post post_type enum
**Decision:** Fixed — removed 'testimony' (doesn't exist in model). Only 'text' and 'prayer_request'.

#### Q3: Post visibility
**Decision:** All imported posts default to `visibility='public'`.

#### Q4-Q8: Users model type corrections
**Decision:** Documentation fixes only:
- `status` enum: 'active', 'deactivated', 'pending_deletion', 'banned'
- `role` enum: 'user', 'moderator', 'admin'
- `bio`: STRING(150) not TEXT
- `location`: STRING(200) not VARCHAR(100)
- `language`: ENUM('en','es') not VARCHAR(5)

#### Q9: Categories + category_user_relations
**Decision:** SKIP both. New categories table is for workshops. Bible/Positivity is handled by `users.mode` enum. Derive mode from old `category_user_relations` data during user import.

#### Q10: Conversation derived columns
**Decision:** Populate during migration:
- `creator_id` = user who sent the first message in the conversation
- `last_message_id` = most recent message ID per conversation
- `last_message_at` = most recent message timestamp per conversation

#### Q11: ConversationParticipant joined_at
**Decision:** Set to conversation's created_at (timestamp of first message).

#### Q12: MessageStatus timestamps
**Decision:** MessageStatus model has `timestamps: false` — only has message_id, user_id, status, status_at. No created_at/updated_at.

#### Q13-Q14: Row count corrections
**Decision:** Documentation fixes:
- dailypostcomments: 4,586 rows (not 872)
- dailypostusers: 23,685 rows (not 2,925)
- notes: 68 rows (not 7)

#### Q15: Unique constraints
**Decision:** Noted for migration script — key constraints:
- post_reactions: (user_id, post_id) UNIQUE
- post_comment_reactions: (user_id, comment_id) UNIQUE
- daily_reactions: (user_id, daily_content_id) UNIQUE
- bookmarks: (user_id, daily_content_id) UNIQUE
- follows: (follower_id, following_id) UNIQUE
- conversation_participants: (conversation_id, user_id) UNIQUE
- message_status: (message_id, user_id) UNIQUE

#### Q16: User ID conflicts — pre-migration wipe
**Decision:** Wipe all tables EXCEPT daily_content, daily_content_translations, videos, video_categories, video_reactions. Import old users with original IDs. Seed admin + testuser at IDs after max imported.

#### Q17: notification_preference
**Decision:** Skip entirely. Old data is push notification type arrays (PUSH_POSTS, PUSH_DAILY_POST, etc.), not email settings. All imported users get default user_settings values.

#### Q18: daily_post_notification_time
**Decision:** Import `daily_post_notification_time` -> `user_settings.daily_reminder_time`. Convert TIME to HH:MM string.

#### Q19: Post comment reaction type enum
**Decision:** Same as all reactions — 'love' (heart).

#### Q20: Usernames > 30 characters
**Decision:** Remove (skip) users with usernames exceeding 30 chars. 14 users affected. Their content is also excluded (orphaned).

#### Q21: Test account cutoff
**Decision:** IDs 1-85 = test accounts (set `status='deactivated'`). ID 86 (`freeluma` / `info@freeluma.com`) = real account, stays active. IDs 87+ = real users.

#### Q22: Admin seeding
**Decision:** Import all old users first with original IDs. Then seed `admin@freeluma.com` and `testuser@freeluma.com` at IDs after the max imported user ID (31,627+).

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
   - `post_media.url` (post images/videos)
   - `message_media.media_url` (chat media)

## Key Transformation Rules

- **Pre-migration wipe:** Truncate all tables except daily_content, daily_content_translations, videos, video_categories, video_reactions
- **User IDs:** Original IDs preserved (no offset). Admin + testuser seeded after import.
- **Username filter:** Skip 14 users with username > 30 chars
- **Test accounts:** IDs 1-85 -> status='deactivated'. ID 86 stays active.
- **Passwords:** `$2y$` -> `$2b$` prefix swap; plaintext -> bcrypt hash
- **parent_id:** Convert 0 -> NULL (root comments) in both post_comments and daily_comments
- **Soft deletes:** Filter out is_deleted=1 rows (posts, comments, dailypostcomments)
- **bible_setting:** FLP -> 'KJV', all others direct copy
- **Reactions:** All old binary likes import as reaction_type='love' (heart) across: post_reactions, post_comment_reactions, daily_reactions
- **Daily content ID resolution:** old dailyposts.id -> dailyposts.daily_post_name (date) -> daily_content.post_date -> daily_content.id
- **Chat restructuring:** Group by min(sender,receiver),max(sender,receiver) -> conversations + 2 participants per pair + messages + media + status
- **Conversation metadata:** creator_id from first sender, last_message_id/last_message_at from most recent message, joined_at from conversation created_at
- **Post visibility:** All imported posts default to 'public'
- **Categories:** SKIP import. Derive users.mode from old category_user_relations.
- **Notification preferences:** SKIP. Default user_settings for all.
- **Daily reminder time:** Import daily_post_notification_time -> user_settings.daily_reminder_time (TIME -> HH:MM string)
- **Media URLs:** Import local filenames as-is. POST-MIGRATION script uploads to B2 and updates URLs.

---

*Generated: 2026-02-15*
*Updated: 2026-02-16 (third review complete)*
*Source: Phase 8 spreadsheet review session (3 rounds, 44 total questions)*
*Spreadsheet: migration-mapping.xlsx (project root)*
