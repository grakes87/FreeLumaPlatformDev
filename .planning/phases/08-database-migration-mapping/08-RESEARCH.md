# Phase 8: Database Migration Mapping - Research

**Researched:** 2026-02-15
**Domain:** SQL schema analysis, data transformation mapping, Excel spreadsheet generation
**Confidence:** HIGH

## Summary

This phase produces a mapping deliverable (`.xlsx` Excel file) that documents how every table and column in the old FreeLuma database (`freelumadatabase`) maps to the new FreeLuma schema (`freeluma_dev`). The old database contains 29 tables with approximately 150,000+ total rows, including ~32,300 users. The new schema has 52 model files across 68 migrations.

The primary technical work is: (1) parsing the old SQL dump to extract all schemas and sample data, (2) analyzing each old column against new schema models to determine mappings and transformations, (3) detecting data quality issues and orphaned records, and (4) generating a well-structured `.xlsx` file using the `exceljs` library.

Key complexity areas include: the old `posts` table combining FEED and PRAYER_WALL types into a single table (new schema splits into `posts` + `prayer_requests`), the old `users` table embedding settings as columns that the new schema normalizes into `user_settings`, media stored as inline JSON arrays vs. the new normalized `post_media` table, password hash format conversion ($2y$ to $2b$), and several "user interaction" pivot tables (`dailypostusers`, `dailypostusercomments`, `usercomments`, `verse_likes`, `verse_user_comments`) that map to different reaction/bookmark models in the new schema.

**Primary recommendation:** Use `exceljs` v4.4.0 to generate the `.xlsx` file. Build a Node.js script that reads the SQL dump, parses CREATE TABLE and INSERT statements via regex, and produces the mapping spreadsheet programmatically. Domain-group the table sheets for logical flow.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| exceljs | 4.4.0 | Generate .xlsx spreadsheet | Most full-featured Node.js Excel library; supports styling, merged cells, multiple sheets, auto-width |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js fs | built-in | Read the SQL dump file | Always - for reading the .sql file |
| Node.js path | built-in | File path handling | Always - for output file paths |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| exceljs | xlsx (SheetJS) | SheetJS community version has limited styling; exceljs has full style control needed for the mapping sheets |
| exceljs | write-excel-file | Simpler API but less control over sheet formatting and cell merging |

**Installation:**
```bash
npm install exceljs
```

Note: `exceljs` should be installed as a devDependency since it is only needed for this migration mapping script, not at runtime.

## Architecture Patterns

### Recommended Script Structure
```
scripts/
  generate-migration-mapping.mjs    # Main script to generate the .xlsx
```

The script should be a standalone ESM module (`.mjs`) that can run independently with `node scripts/generate-migration-mapping.mjs`. It does NOT need to connect to any database -- it parses the SQL dump file directly.

### Pattern 1: SQL Dump Parsing via Regex
**What:** Parse CREATE TABLE and INSERT INTO statements from the SQL dump using regular expressions.
**When to use:** Always -- the SQL dump is a flat file, not a live database connection.
**Approach:**
```javascript
// Parse CREATE TABLE to get schema
const createTableRegex = /CREATE TABLE `(\w+)` \(([\s\S]*?)\) ENGINE/g;

// Parse INSERT INTO to get sample data
const insertRegex = /INSERT INTO `(\w+)` \(([^)]+)\) VALUES\s*\n([\s\S]*?);/g;
```

**Key considerations:**
- The SQL dump is 157,564 lines (~7.5MB) -- can be read entirely into memory
- INSERT statements for large tables (e.g., `users` with 32K rows) span hundreds of INSERT statements
- Only need 5 sample rows per table, so extract from the first INSERT statement per table
- Must handle escaped quotes, unicode escape sequences, and multi-line text values in INSERT data

### Pattern 2: Schema Comparison Engine
**What:** For each old table column, programmatically look up the corresponding new model file to determine mapping.
**When to use:** To generate the column-by-column mapping sheets.
**Approach:** The script should contain a hardcoded mapping configuration that documents each old-to-new table/column correspondence, derived from the analysis done during this phase.

### Pattern 3: Domain-Grouped Sheet Organization
**What:** Organize sheets by functional domain rather than alphabetically.
**When to use:** Always -- makes the spreadsheet navigable.
**Recommended order:**
1. **Overview** (summary sheet)
2. **Users Domain:** `users`, `settings`, `subscribewebpushes`
3. **Categories Domain:** `categories`, `category_user_relations`, `homescreen_tile_categories`
4. **Social/Posts Domain:** `posts`, `comments`, `usercomments`
5. **Daily Content Domain:** `dailyposts`, `dailypostcomments`, `dailypostusercomments`, `dailypostusers`, `dailychapters`
6. **Verse Domain:** `verses`, `verse_comments`, `verse_likes`, `verse_user_comments`
7. **Chat Domain:** `chats`
8. **Notes Domain:** `notes`
9. **Notifications Domain:** `notifications`
10. **Video Domain:** `uservideos`, `uservideorelations`
11. **Workshop Domain (excluded):** `workshops`, `workshop_series`, `workshop_interests`, `workshop_invitations`, `workshoplogs`

### Anti-Patterns to Avoid
- **Connecting to the old database live:** The SQL dump file contains everything needed. No database connection required.
- **Auto-generating mappings without review:** The mapping configuration must be hand-verified. Automated column name matching would miss semantic differences (e.g., old `likes_count` is a denormalized counter vs. new schema computing it from `post_reactions`).
- **Dropping the `liked_posts` JSON column without analysis:** The old `users.liked_posts` column contains JSON arrays of post IDs. This data represents post reactions and must map to `post_reactions` rows.

## Old Database Schema Catalog

### Complete Table Inventory (29 tables)

| # | Old Table | Approx Rows | Domain | Migration Status |
|---|-----------|-------------|--------|------------------|
| 1 | `categories` | 2 | Categories | Maps to `categories` |
| 2 | `category_user_relations` | 44,631 | Categories | Maps to `user_categories` |
| 3 | `chats` | 286 | Messaging | Maps to `conversations` + `messages` |
| 4 | `comments` | 620 | Social | Maps to `post_comments` |
| 5 | `dailychapters` | 1,737 | Daily Content | Maps to `listen_logs` |
| 6 | `dailypostcomments` | 3,146 | Daily Content | Maps to `daily_comments` |
| 7 | `dailyposts` | 702 | Daily Content | Maps to `daily_content` |
| 8 | `dailypostusercomments` | 6,733 | Daily Content | Maps to `daily_reactions` (on comments -- NEEDS DECISION) |
| 9 | `dailypostusers` | 23,685 | Daily Content | Splits into `daily_reactions` + `bookmarks` |
| 10 | `follows` | 1,194 | Social | Maps to `follows` |
| 11 | `homescreen_tile_categories` | 10 | Categories | NEEDS DECISION -- no direct equivalent |
| 12 | `notes` | 7 | Notes | NEEDS DECISION -- no direct equivalent (Bookmark.notes?) |
| 13 | `notifications` | 28,480 | Notifications | Maps to `notifications` (complex transformation) |
| 14 | `posts` | ~2,500 (est, 42 in dump subset) | Social | Splits into `posts` + `post_media` + `prayer_requests` |
| 15 | `settings` | 2 | Platform | Maps to `platform_settings` |
| 16 | `subscribewebpushes` | 78 | Push | Maps to `push_subscriptions` |
| 17 | `usercomments` | 494 | Social | Maps to `post_comment_reactions` |
| 18 | `users` | 32,319 | Users | Maps to `users` + `user_settings` |
| 19 | `uservideorelations` | 1,159 | Video | Maps to `video_progress` |
| 20 | `uservideos` | 4 | Video | Maps to `videos` |
| 21 | `verses` | 3,409 | Verses | NEEDS DECISION -- no direct equivalent |
| 22 | `verse_comments` | 42 | Verses | NEEDS DECISION -- no direct equivalent |
| 23 | `verse_likes` | 3,716 | Verses | NEEDS DECISION -- no direct equivalent |
| 24 | `verse_user_comments` | 1 | Verses | NEEDS DECISION -- no direct equivalent |
| 25 | `workshoplogs` | 371 | Workshop | EXCLUDED (rebuilt in Phase 5) |
| 26 | `workshops` | 506 | Workshop | EXCLUDED (rebuilt in Phase 5) |
| 27 | `workshop_interests` | 257 | Workshop | EXCLUDED (rebuilt in Phase 5) |
| 28 | `workshop_invitations` | 2 | Workshop | EXCLUDED (rebuilt in Phase 5) |
| 29 | `workshop_series` | 42 | Workshop | EXCLUDED (rebuilt in Phase 5) |

### Critical Observations About Data

1. **Posts count appears very low (42 in dump):** The SQL dump may only contain a subset of posts. The dump has 19 separate INSERT INTO `posts` statements but each contains only 2-3 rows. The IDs jump from 23 to 189 to 351, suggesting the total post count is likely in the thousands when considering the full range of IDs (up to at least ~2,500+). The dump may be filtered or some posts may have been deleted before the dump was taken. This should be flagged in the spreadsheet.

2. **User IDs have large gaps:** IDs range from 1 to ~18,000+, but there are ~32,300 rows. Many early IDs are test accounts (first ~85 IDs are dev/test usernames like `zhr`, `test1234`, `shady123`).

3. **Plaintext passwords exist:** User ID 6 has password `123zhr` (plaintext). This confirms MIG-03 requirement -- plaintext passwords must be flagged for forced password reset.

4. **$2y$ bcrypt hashes:** Most passwords use `$2y$10$...` format. The new schema uses `$2b$` prefix. Conversion: simple string replacement `$2y$` -> `$2b$` (PHP bcrypt vs. Node bcrypt compatibility).

5. **The `posts.media` column is a JSON array:** Contains `[{"file_name":"xxx.jpg","file_type":"image"}]`. Must be extracted and inserted as rows in new `post_media` table.

6. **Old `posts` table combines two types:** `post_type` ENUM('PRAYER_WALL','FEED'). PRAYER_WALL posts map to new `posts` with `post_type='prayer_request'` plus a `prayer_requests` row. FEED posts map to `posts` with `post_type='text'`.

7. **`dailypostusers` is a dual-purpose pivot:** `is_liked` flag = reaction, `is_bookmarked` flag = bookmark. Must split into `daily_reactions` (where is_liked=1) and `bookmarks` (where is_bookmarked=1).

8. **Date of birth has invalid values:** `dob` field contains `'0000-00-00'` for many users. Must convert to NULL in new schema.

9. **Old `chats` table is flat (no conversations):** Each chat row has `sender_id` and `receiver_id`. New schema uses `conversations` -> `conversation_participants` -> `messages`. Must group chats by sender/receiver pairs to create conversations.

10. **`notes` table is user journals:** Contains personal text/audio notes with HTML content. The new schema has no direct equivalent personal notes table (only `workshop_notes`). This needs a user decision.

11. **`verses` table is separate daily content:** Contains verse_name (Bible references) with likes/comments. The new schema handles verses through `daily_content.verse_reference`. The verse interaction data needs a decision on how to handle.

## Key Transformation Rules

### User Table Transformations

| Old Column | New Column | Transformation |
|------------|------------|----------------|
| `id` | `id` | Direct copy (preserve IDs) |
| `first_name` | `display_name` | Copy as-is (was used as display name) |
| `last_name` | (merged into display_name) | Concatenate: `first_name + ' ' + last_name` if last_name not empty |
| `username` | `username` | Direct copy |
| `email` | `email` | Direct copy |
| `password` | `password_hash` | Replace `$2y$` with `$2b$`; flag plaintext passwords |
| `profile_picture` | `avatar_url` | Prefix with storage URL path (MIG-08) |
| `city` + `state` + `country` | `location` | Merge: `city, state, country` (filter empties) |
| `followings_count` | -- | COMPUTED in new schema (COUNT from follows table) |
| `followers_count` | -- | COMPUTED in new schema (COUNT from follows table) |
| `posts_count` | -- | COMPUTED in new schema (COUNT from posts table) |
| `liked_posts` | -> `post_reactions` rows | JSON array of post IDs -> create PostReaction rows with type 'like' |
| `dob` | `date_of_birth` | Rename; convert `0000-00-00` to NULL |
| `phone` | -- | NEEDS DECISION -- no column in new schema |
| `bookmark_setting` | `preferred_translation` | Rename; maps Bible translation preference |
| `bible_setting` | -- | NEEDS DECISION -- may map to `preferred_translation` or `mode` |
| `notification_preference` | -> `user_settings` | JSON -> split into UserSetting boolean columns |
| `account_visibility` | `profile_privacy` | Rename + lowercase: PUBLIC->public, PRIVATE->private |
| `daily_post_notification_time` | -> `user_settings.daily_reminder_time` | Move to UserSetting table |
| `tile_category` | -- | NEEDS DECISION -- relates to homescreen_tile_categories |
| `top_slide_preference` | -- | NEEDS DECISION -- no equivalent in new schema |
| `comment_hidden` | -- | NEEDS DECISION -- no direct equivalent |
| -- | `google_id` | COMPUTED in new schema -- no migration needed |
| -- | `apple_id` | COMPUTED in new schema -- no migration needed |
| -- | `avatar_color` | COMPUTED in new schema -- generate random color |
| -- | `bio` | COMPUTED in new schema -- default NULL |
| -- | `denomination` | COMPUTED in new schema -- default NULL |
| -- | `church` | COMPUTED in new schema -- default NULL |
| -- | `testimony` | COMPUTED in new schema -- default NULL |
| -- | `website` | COMPUTED in new schema -- default NULL |
| -- | `mode` | Derive from category_user_relations: BIBLE category -> 'bible', POSITIVITY -> 'positivity' |
| -- | `timezone` | Default 'America/New_York' |
| -- | `language` | Default 'en' |
| -- | `email_verified` | Default true for migrated users |
| -- | `onboarding_complete` | Default true for migrated users |
| -- | `status` | Default 'active' |
| -- | `role` | Default 'user' |

### Post Table Transformations

| Old Column | New Column | Transformation |
|------------|------------|----------------|
| `id` | `id` | Direct copy |
| `user_id` | `user_id` | Direct copy |
| `text_content` | `body` | Rename; strip HTML if needed |
| `post_type` | `post_type` | Map: FEED->'text', PRAYER_WALL->'prayer_request' |
| `media` | -> `post_media` rows | Parse JSON array, create PostMedia rows |
| `cover_media` | -- | NEEDS DECISION -- index into media array? |
| `likes_count` | -- | COMPUTED in new schema |
| `comments_count` | -- | COMPUTED in new schema |
| `shares_count` | -- | COMPUTED in new schema |
| `is_updated` | `edited` | Rename boolean |
| `is_deleted` | `deleted_at` | Convert: is_deleted=1 -> set deleted_at=updatedAt |
| `category_id` | `mode` | Map: category 1 (BIBLE) -> 'bible', category 2 (POSITIVITY) -> 'positivity' |

### Follow Table Transformations

| Old Column | New Column | Transformation |
|------------|------------|----------------|
| `id` | `id` | Direct copy |
| `follower_id` | `follower_id` | Direct copy |
| `following_id` | `following_id` | Direct copy |
| `status` | `status` | Map: 1 -> 'active', 0 -> 'pending' |
| `request_follow` | -- | Redundant with status (already captured in status=0 meaning pending) |

### Notification Table Transformations (Complex)

The old notifications table has a complex schema with many context-specific columns. The new schema uses a normalized approach:

| Old Column(s) | New Column | Transformation |
|---------------|------------|----------------|
| `user_id` | `recipient_id` | Rename |
| `action_done_by` | `actor_id` | Rename |
| `notification_type` | `type` | Map: FOLLOW->'follow', LIKE->'reaction', COMMENT->'comment', CHAT->'message', WORKSHOP->'workshop_*' |
| `is_seen` | `is_read` | Rename |
| `post_id` / `comment_id` / `daily_post_comment_id` / `chat_id` / `workshop_id` | `entity_id` | Select non-null/non-zero value |
| -- | `entity_type` | Derive from which old column has a value: post_id->'post', comment_id->'comment', etc. |
| `like_type` + `comment_type` | `type` (refined) | Use to determine specific type and entity_type |
| `request_follow` / `accept_follow` | `type` | request_follow=1 -> 'follow_request' |

### Chat to Conversation Transformation (Complex)

The old `chats` table is a flat message table. Must be restructured:

1. **Group by unique sender/receiver pairs** (treating (A,B) and (B,A) as same conversation)
2. **Create `conversations` rows** for each unique pair
3. **Create `conversation_participants` rows** (2 per conversation)
4. **Map each `chats` row to a `messages` row** with the conversation_id

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel file generation | Custom XML/ZIP builder | `exceljs` v4.4.0 | Excel format is complex; exceljs handles styles, merged cells, auto-filters |
| SQL parsing | Full SQL parser library | Targeted regex patterns | The dump format is consistent (phpMyAdmin); regex works reliably for CREATE TABLE and INSERT INTO |
| bcrypt $2y$ -> $2b$ | Re-hash passwords | String prefix replacement | $2y$ and $2b$ are compatible; PHP and Node bcrypt produce identical hashes, only the prefix differs |

**Key insight:** This phase produces a documentation artifact (spreadsheet), not executable migration code. The complexity is in the analysis and transformation rule documentation, not in library usage.

## Common Pitfalls

### Pitfall 1: Missing Tables Due to Workshop Exclusion Confusion
**What goes wrong:** Some old tables are related to workshops but also have general-purpose data.
**Why it happens:** The `homescreen_tile_categories` table has categories that look workshop-related but are actually used for daily verse tiles.
**How to avoid:** Only exclude tables explicitly named `workshop*` or `workshoplog*`. All other tables get their own sheet, even if flagged as NEEDS DECISION.
**Warning signs:** A table is excluded that has data referenced by non-workshop features.

### Pitfall 2: Posts Row Count Discrepancy
**What goes wrong:** The SQL dump appears to have only ~42 post rows, but the actual database likely has thousands.
**Why it happens:** The phpMyAdmin dump may use extended INSERT statements where row tuples are separated by commas across many lines. Large tables get split into multiple INSERT statements.
**How to avoid:** Count actual data tuples (parenthesized groups) rather than INSERT statements. Also check the AUTO_INCREMENT value in the dump for the actual max ID.
**Warning signs:** A table's row count seems impossibly low given the volume of related data (e.g., 620 comments for only 42 posts would be suspicious).

### Pitfall 3: JSON Column Parsing Failures
**What goes wrong:** The `posts.media`, `users.liked_posts`, `users.notification_preference`, and `subscribewebpushes.subscription` columns contain JSON that may have escaped characters.
**Why it happens:** JSON inside SQL INSERT statements has double-escaped quotes and special characters.
**How to avoid:** When extracting sample data, unescape SQL string escaping before JSON.parse(). Handle `NULL` values and empty strings (`''`, `'[]'`).
**Warning signs:** JSON.parse() errors on sample values.

### Pitfall 4: parent_id=0 vs NULL for Root Comments
**What goes wrong:** The old `comments` and `dailypostcomments` tables use `parent_id=0` for root-level comments. The new schema uses `parent_id=NULL`.
**Why it happens:** Different conventions for "no parent" between old and new schemas.
**How to avoid:** Document transformation: `parent_id=0` -> `parent_id=NULL`.
**Warning signs:** Foreign key constraint violations during migration if 0 is passed as parent_id.

### Pitfall 5: Denormalized Counter Columns
**What goes wrong:** Old schema has `likes_count`, `comments_count`, `shares_count`, `followers_count`, `followings_count`, `posts_count`, `reply_count` -- all denormalized counters. New schema computes these from relationships.
**Why it happens:** The old platform cached counts in columns. The new platform computes counts dynamically or uses Sequelize aggregations.
**How to avoid:** Mark ALL `*_count` columns as "COMPUTED in new schema -- no migration needed" in the spreadsheet. Do NOT migrate counter values.
**Warning signs:** Migrating stale counter values that don't match actual row counts.

### Pitfall 6: HTML Content in Text Fields
**What goes wrong:** Old `posts.text_content` and `notes.content` contain HTML markup (`<p>`, `<span>`, rich text styling). The new `posts.body` is plain text.
**Why it happens:** The old platform used a rich text editor.
**How to avoid:** Document the transformation as "strip HTML tags" or "convert to plain text". Include sample before/after showing HTML -> plain text conversion.
**Warning signs:** Raw HTML appearing in the new platform's post feeds.

### Pitfall 7: Date Format Issues
**What goes wrong:** Old `users.dob` contains `'0000-00-00'` which is an invalid date in most systems.
**Why it happens:** MySQL allows `0000-00-00` as a default date, but it's meaningless.
**How to avoid:** Map `'0000-00-00'` to `NULL` in the transformation rules.
**Warning signs:** Date parsing errors or display of "January 1, 0000" in the app.

## Code Examples

### ExcelJS Workbook Creation
```javascript
// Source: exceljs GitHub README
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
workbook.creator = 'FreeLuma Migration Tool';
workbook.created = new Date();

// Create overview sheet
const overview = workbook.addWorksheet('Overview', {
  properties: { tabColor: { argb: 'FF4472C4' } }
});

// Define columns with headers
overview.columns = [
  { header: 'Old Table', key: 'oldTable', width: 30 },
  { header: 'Status', key: 'status', width: 15 },
  { header: 'New Table', key: 'newTable', width: 30 },
  { header: 'Row Count', key: 'rowCount', width: 12 },
  { header: 'Notes', key: 'notes', width: 50 },
];

// Style header row
overview.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
overview.getRow(1).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' }
};

// Add data rows
overview.addRow({
  oldTable: 'users',
  status: 'MAPPED',
  newTable: 'users + user_settings',
  rowCount: 32319,
  notes: 'Split: profile to users, settings to user_settings'
});
```

### Table Mapping Sheet Pattern
```javascript
function createTableSheet(workbook, tableName, mappings, sampleData) {
  const sheet = workbook.addWorksheet(tableName);

  // Column mapping headers
  sheet.columns = [
    { header: 'Old Column', key: 'oldCol', width: 20 },
    { header: 'Old Type', key: 'oldType', width: 20 },
    { header: 'New Table', key: 'newTable', width: 20 },
    { header: 'New Column', key: 'newCol', width: 20 },
    { header: 'New Type', key: 'newType', width: 20 },
    { header: 'Transformation', key: 'transform', width: 35 },
    { header: 'Sample Old Value', key: 'sampleOld', width: 30 },
    { header: 'Expected New Value', key: 'sampleNew', width: 30 },
    { header: 'Data Quality Notes', key: 'quality', width: 35 },
  ];

  // Style header
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFD9E2F3' }
  };

  // Add mapping rows
  for (const mapping of mappings) {
    sheet.addRow(mapping);
  }

  // Add separator row
  const sepRow = sheet.addRow({});

  // Add relationship section header
  const relHeader = sheet.addRow({ oldCol: 'RELATIONSHIPS' });
  relHeader.font = { bold: true, size: 12 };

  // Add relationship details...
}
```

### SQL Dump Parsing
```javascript
function parseCreateTable(sqlContent, tableName) {
  const regex = new RegExp(
    `CREATE TABLE \\\`${tableName}\\\` \\(([\\s\\S]*?)\\) ENGINE`,
    'm'
  );
  const match = sqlContent.match(regex);
  if (!match) return null;

  const columnDefs = match[1].split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('`'))
    .map(line => {
      const colMatch = line.match(/`(\w+)`\s+(.+?)(?:,)?$/);
      return colMatch ? { name: colMatch[1], type: colMatch[2] } : null;
    })
    .filter(Boolean);

  return columnDefs;
}

function extractSampleRows(sqlContent, tableName, limit = 5) {
  const regex = new RegExp(
    `INSERT INTO \\\`${tableName}\\\`[^)]+\\)\\s+VALUES\\s*\\n([\\s\\S]*?);`,
    'm'
  );
  const match = sqlContent.match(regex);
  if (!match) return [];

  // Extract individual tuples
  const tuples = [];
  let depth = 0;
  let current = '';
  for (const char of match[1]) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth > 0 || (depth === 0 && char === ')')) {
      current += char;
    }
    if (depth === 0 && current) {
      tuples.push(current);
      current = '';
      if (tuples.length >= limit) break;
    }
  }

  return tuples;
}
```

### Password Hash Conversion Check
```javascript
function analyzePasswordFormats(userRows) {
  const formats = { bcrypt_2y: 0, bcrypt_2b: 0, plaintext: 0, other: 0 };
  for (const row of userRows) {
    const password = row.password;
    if (password.startsWith('$2y$')) formats.bcrypt_2y++;
    else if (password.startsWith('$2b$')) formats.bcrypt_2b++;
    else if (!password.startsWith('$')) formats.plaintext++;
    else formats.other++;
  }
  return formats;
}
// Transformation: '$2y$10$...' -> '$2b$10$...'
```

## Relationship Analysis

### Old Database Relationships (Explicit FKs via Indexes)

| Parent Table | Child Table | FK Column | Relationship |
|-------------|-------------|-----------|--------------|
| `users` | `category_user_relations` | `user_id` | 1:N |
| `categories` | `category_user_relations` | `category_id` | 1:N |
| `users` | `chats` | `sender_id`, `receiver_id` | 1:N (both) |
| `users` | `comments` | `user_id` | 1:N |
| `posts` | `comments` | `post_id` | 1:N |
| `comments` | `comments` | `parent_id` | Self-referential 1:N |
| `users` | `dailychapters` | `user_id` | 1:N |
| `dailyposts` | `dailypostcomments` | `daily_post_id` | 1:N |
| `users` | `dailypostcomments` | `user_id` | 1:N |
| `categories` | `dailypostcomments` | `category_id` | 1:N |
| `dailypostcomments` | `dailypostusercomments` | `comment_id` | 1:N |
| `users` | `dailypostusercomments` | `user_id` | 1:N |
| `dailyposts` | `dailypostusers` | `daily_post_id` | 1:N |
| `users` | `dailypostusers` | `user_id` | 1:N |
| `users` | `follows` | `follower_id`, `following_id` | 1:N (both) |
| `users` | `notes` | `user_id` | 1:N |
| `users` | `notifications` | `user_id`, `action_done_by` | 1:N (both) |
| `users` | `posts` | `user_id` | 1:N |
| `categories` | `posts` | `category_id` | 1:N |
| `users` | `subscribewebpushes` | `user` | 1:N |
| `comments` | `usercomments` | `comment_id` | 1:N |
| `users` | `usercomments` | `user_id` | 1:N |
| `uservideos` | `uservideorelations` | `uservideo_id` | 1:N |
| `users` | `uservideorelations` | `user_id` | 1:N |
| `verses` | `verse_comments` | `verse_id` | 1:N |
| `users` | `verse_comments` | `user_id` | 1:N |
| `users` | `verse_likes` | `user_id` | 1:N |
| `verse_comments` | `verse_user_comments` | `comment_id` | 1:N |
| `users` | `verse_user_comments` | `user_id` | 1:N |
| `workshop_series` | `workshops` | `series_id` | 1:N |
| `workshops` | `workshoplogs` | `workshop_id` | 1:N |
| `users` | `workshoplogs` | `user_id` | 1:N |
| `workshops` | `workshop_interests` | `workshop_id` | 1:N |
| `users` | `workshop_interests` | `user_id` | 1:N |
| `workshops` | `workshop_invitations` | `workshop_id` | 1:N |
| `users` | `workshop_invitations` | `user_id` | 1:N |
| `users` | `workshop_series` | `created_by` | 1:N |
| `homescreen_tile_categories` | (implicit via `users.tile_category`) | -- | Implicit |
| `categories` | (implicit via `dailypostusers.category_id`) | -- | Implicit |

### Implicit/Application-Level Relationships

1. **`users.liked_posts` JSON -> `posts`:** The JSON array contains post IDs, creating an implicit M:N between users and posts (for likes).
2. **`verse_likes.verse_name` -> `verses.verse_name`:** Joined by verse name string, NOT by ID. This is an application-level relationship without a foreign key.
3. **`notifications` polymorphic references:** `post_id`, `comment_id`, `daily_post_comment_id`, `chat_id`, `workshop_id` each reference different tables depending on `notification_type`.
4. **`workshop_series.invited_members` JSON -> `users`:** JSON array of user IDs, implicit M:N.
5. **`workshops.blocked_users` JSON -> `users`:** JSON array of user IDs, implicit M:N.

## Data Quality Concerns

### Per-Table Issues to Flag

| Table | Column | Issue | Severity |
|-------|--------|-------|----------|
| `users` | `password` | At least 1 plaintext password (`123zhr`, user_id=6) | HIGH |
| `users` | `dob` | Contains `0000-00-00` invalid dates | MEDIUM |
| `users` | `profile_picture` | Mix of filenames (`default.jpg`, `username.jpg`, `username.png`) -- need full URL path | MEDIUM |
| `users` | `liked_posts` | JSON array that may contain IDs of deleted posts | LOW |
| `posts` | `text_content` | Contains HTML markup; some have empty `<p></p>` bodies | MEDIUM |
| `posts` | `media` | JSON array format inconsistent; some have `[]`, some NULL | LOW |
| `comments` | `parent_id` | Uses 0 instead of NULL for root comments | MEDIUM |
| `dailypostcomments` | `parent_id` | Uses 0 instead of NULL for root comments | MEDIUM |
| `follows` | `status` | Uses 0/1 integers instead of enum strings | LOW |
| `chats` | `message` | Contains unicode escape sequences (e.g., `U+2764U+FE0F`) | LOW |
| `notes` | `content` | Contains rich HTML with inline styles | MEDIUM |
| `notifications` | multiple | Very wide table with many nullable context columns | LOW |
| `verse_likes` | `verse_name` | Some entries have empty string for verse_name | MEDIUM |
| `verse_likes` | -- | References verses by NAME not ID (fragile join) | HIGH |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Denormalized counters (`likes_count`, etc.) | Computed via COUNT queries/aggregation | New schema design | Don't migrate counter values |
| Single `posts` table with PRAYER_WALL/FEED enum | Separate `posts` + `prayer_requests` tables | New schema design | Must split post types |
| Flat `chats` table (sender/receiver per row) | `conversations` + `participants` + `messages` | Phase 3 design | Complex grouping transformation |
| User settings embedded in `users` table | Separate `user_settings` table | Phase 1 design | Must extract and create UserSetting rows |
| JSON arrays in columns (`liked_posts`, `media`) | Normalized relationship tables | New schema design | Must parse JSON and create rows |
| `$2y$` bcrypt prefix (PHP) | `$2b$` bcrypt prefix (Node.js) | Platform migration | String prefix replacement |
| `is_deleted` boolean flag | `deleted_at` paranoid timestamp | New schema design | Convert flag to timestamp |

## Open Questions

Things that need user decision during the mapping:

1. **`notes` table (7 rows) -- personal journal notes**
   - What we know: Contains personal text and audio notes with HTML content
   - What's unclear: No equivalent in new schema. Closest is `workshop_notes` but that's workshop-specific
   - Recommendation: Flag as NEEDS DECISION in spreadsheet. Options: (a) create a new `notes` migration, (b) drop (only 7 rows, may be test data), (c) convert to bookmarks with notes text

2. **`verses` table family (3,409 verses + 42 comments + 3,716 likes)**
   - What we know: These are daily Bible verse tiles with user interactions. New schema has `daily_content` with `verse_reference` but verses are not a standalone entity
   - What's unclear: Whether verse interactions should be migrated or if the verse system was replaced entirely by `daily_content`
   - Recommendation: Flag as NEEDS DECISION. The verse data volume is significant (3.7K likes). Consider mapping verse interactions to `daily_reactions` on corresponding `daily_content` entries

3. **`homescreen_tile_categories` (10 rows)**
   - What we know: Contains categories like 'hopeandencouragement', 'anxietyandstress', etc. for homescreen tiles
   - What's unclear: Whether these map to `video_categories` or are completely superseded by the new UI
   - Recommendation: Flag as NEEDS DECISION

4. **`users.phone` column**
   - What we know: The old schema has a phone column. The new User model has no phone field
   - What's unclear: Whether phone numbers should be preserved
   - Recommendation: Flag as NEEDS DECISION

5. **`users.bookmark_setting` vs `users.bible_setting`**
   - What we know: Two separate settings columns. New schema has single `preferred_translation`
   - What's unclear: Which one maps to `preferred_translation` and whether the other has meaning
   - Recommendation: Flag with note explaining both values; show sample data to help user decide

6. **`posts` row count discrepancy**
   - What we know: Only ~42 rows in the SQL dump, but related tables suggest thousands of posts existed
   - What's unclear: Whether the dump is complete or filtered
   - Recommendation: Flag prominently in the overview sheet; include row count note

## Sources

### Primary (HIGH confidence)
- Old Database SQL dump: `/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/Old Database/main free luma database.sql` -- 157,564 lines, all 29 CREATE TABLE and INSERT statements analyzed
- New schema models: `/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/src/lib/db/models/` -- all 52 model files reviewed
- New schema associations: `/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/src/lib/db/models/index.ts` -- 1001 lines of association definitions reviewed

### Secondary (MEDIUM confidence)
- [exceljs npm package](https://www.npmjs.com/package/exceljs) -- v4.4.0 confirmed via `npm view`
- [exceljs GitHub](https://github.com/exceljs/exceljs) -- API patterns reviewed

### Tertiary (LOW confidence)
- Posts row count estimate (~42 in dump) -- may not reflect actual database size; marked for validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- exceljs is the standard, version confirmed
- Old schema analysis: HIGH -- every CREATE TABLE parsed directly from the SQL dump
- New schema analysis: HIGH -- every model file read directly from the codebase
- Transformation rules: HIGH -- derived from direct comparison of old and new schemas
- Data quality observations: HIGH -- derived from actual sample data in the SQL dump
- Row counts: MEDIUM -- parsed from INSERT statements but posts count seems low
- Verse/notes migration decisions: LOW -- require user input, flagged as NEEDS DECISION

**Research date:** 2026-02-15
**Valid until:** No expiration (based on stable SQL dump + frozen schema)
