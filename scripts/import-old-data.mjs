#!/usr/bin/env node
/**
 * FreeLuma Data Import Script
 *
 * Imports data from the old FreeLuma database SQL dump into the new schema.
 * Reference: .planning/phases/08-database-migration-mapping/MIGRATION-DECISIONS.md
 *
 * Usage: node scripts/import-old-data.mjs [--dry-run] [--table=users]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SQL_DUMP_PATH = path.join(PROJECT_ROOT, 'Old Database', 'Main Free Luma Database.sql');
const PRE_MIGRATION_PATH = path.join(PROJECT_ROOT, 'Old Database', 'freeluma_dev_pre_migration_2026-02-16.sql');
const ACTIVATION_CODES_PATH = path.join(PROJECT_ROOT, 'Old Code', 'FreeLumaDev-new', 'free-luma-api', 'public', 'uploads', 'activation_codes.txt');

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONLY_TABLE = args.find(a => a.startsWith('--table='))?.split('=')[1];
const BCRYPT_ROUNDS = 12;
const BATCH_SIZE = 500;

// ─── Stats tracking ─────────────────────────────────────────────────────────
const stats = {
  users: { imported: 0, skipped: 0 },
  user_settings: { imported: 0, skipped: 0 },
  posts: { imported: 0, skipped: 0 },
  post_media: { imported: 0, skipped: 0 },
  prayer_requests: { imported: 0, skipped: 0 },
  post_reactions: { imported: 0, skipped: 0 },
  post_comments: { imported: 0, skipped: 0 },
  post_comment_reactions: { imported: 0, skipped: 0 },
  follows: { imported: 0, skipped: 0 },
  conversations: { imported: 0, skipped: 0 },
  conversation_participants: { imported: 0, skipped: 0 },
  messages: { imported: 0, skipped: 0 },
  message_media: { imported: 0, skipped: 0 },
  message_status: { imported: 0, skipped: 0 },
  daily_comments: { imported: 0, skipped: 0 },
  daily_reactions: { imported: 0, skipped: 0 },
  bookmarks: { imported: 0, skipped: 0 },
  daily_comment_reactions: { imported: 0, skipped: 0 },
  activation_codes: { imported: 0, skipped: 0 },
};

// ─── SQL Parser ──────────────────────────────────────────────────────────────

/**
 * Parse all INSERT statements for a given table from the SQL dump.
 * Returns array of row objects with column names as keys.
 */
function parseTable(sqlContent, tableName) {
  const rows = [];
  // Match INSERT INTO `tableName` (columns) VALUES
  const insertRegex = new RegExp(
    `INSERT INTO \\\`${tableName}\\\` \\(([^)]+)\\) VALUES\\s*`,
    'g'
  );

  let match;
  while ((match = insertRegex.exec(sqlContent)) !== null) {
    // Parse column names
    const columns = match[1].split(',').map(c => c.trim().replace(/`/g, ''));

    // Parse the VALUES section - need to handle nested parens, strings with commas, etc.
    let pos = match.index + match[0].length;
    const parsedRows = parseValues(sqlContent, pos, columns);
    rows.push(...parsedRows);
  }

  return rows;
}

/**
 * Parse VALUES section of an INSERT statement.
 * Handles: nested parens, escaped quotes, NULL, numbers, strings with HTML.
 */
function parseValues(sql, startPos, columns) {
  const rows = [];
  let pos = startPos;
  const len = sql.length;

  while (pos < len) {
    // Skip whitespace
    while (pos < len && /\s/.test(sql[pos])) pos++;

    if (sql[pos] !== '(') break; // End of VALUES
    pos++; // skip opening (

    // Parse one row's values
    const values = [];
    let valueStart = pos;
    let inString = false;
    let depth = 0;

    while (pos < len) {
      const ch = sql[pos];

      if (inString) {
        if (ch === '\\') {
          pos += 2; // skip escaped char
          continue;
        }
        if (ch === "'") {
          // Check for '' (escaped quote in SQL)
          if (pos + 1 < len && sql[pos + 1] === "'") {
            pos += 2;
            continue;
          }
          inString = false;
        }
        pos++;
        continue;
      }

      if (ch === "'") {
        inString = true;
        pos++;
        continue;
      }

      if (ch === '(') { depth++; pos++; continue; }
      if (ch === ')') {
        if (depth > 0) { depth--; pos++; continue; }
        // End of row
        values.push(parseValue(sql.substring(valueStart, pos).trim()));
        pos++; // skip closing )
        break;
      }

      if (ch === ',' && depth === 0) {
        values.push(parseValue(sql.substring(valueStart, pos).trim()));
        pos++;
        valueStart = pos;
        continue;
      }

      pos++;
    }

    // Build row object
    if (values.length === columns.length) {
      const row = {};
      for (let i = 0; i < columns.length; i++) {
        row[columns[i]] = values[i];
      }
      rows.push(row);
    }

    // Skip comma or semicolon between rows
    while (pos < len && /[\s,]/.test(sql[pos])) pos++;
    if (sql[pos] === ';') break; // End of INSERT statement
  }

  return rows;
}

/**
 * Parse a single SQL value string into a JS value.
 */
function parseValue(raw) {
  if (raw === 'NULL') return null;
  if (raw.startsWith("'") && raw.endsWith("'")) {
    // String value - unescape
    let s = raw.slice(1, -1);
    s = s.replace(/''/g, "'");
    s = s.replace(/\\'/g, "'");
    s = s.replace(/\\"/g, '"');
    s = s.replace(/\\\\/g, '\\');
    s = s.replace(/\\n/g, '\n');
    s = s.replace(/\\r/g, '\r');
    s = s.replace(/\\t/g, '\t');
    s = s.replace(/\\0/g, '\0');
    return s;
  }
  // Number
  const num = Number(raw);
  if (!isNaN(num) && raw !== '') return num;
  return raw;
}

// ─── HTML Stripping ──────────────────────────────────────────────────────────

function stripHtml(html) {
  if (!html) return html;
  // Decode common HTML entities
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

// ─── Database Connection ─────────────────────────────────────────────────────

async function getConnection() {
  return mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
    database: 'freeluma_dev',
    multipleStatements: true,
    charset: 'utf8mb4',
  });
}

// ─── Pre-Migration Wipe ──────────────────────────────────────────────────────

async function wipeTables(conn) {
  console.log('\n=== PRE-MIGRATION WIPE ===');

  // Tables to wipe (order matters for FK constraints — children first)
  const tablesToWipe = [
    'daily_comment_reactions',
    'daily_reactions',
    'daily_comments',
    'bookmarks',
    'message_status',
    'message_media',
    'message_reactions',
    'messages',
    'conversation_participants',
    'conversations',
    'post_comment_reactions',
    'post_comments',
    'post_reactions',
    'post_media',
    'post_impressions',
    'prayer_supports',
    'prayer_requests',
    'reposts',
    'posts',
    'follows',
    'blocks',
    'bans',
    'reports',
    'moderation_logs',
    'notifications',
    'push_subscriptions',
    'email_logs',
    'drafts',
    'activity_streaks',
    'listen_logs',
    'user_settings',
    'user_categories',
    'activation_codes',
    'workshop_chats',
    'workshop_notes',
    'workshop_attendees',
    'workshop_invites',
    'workshop_bans',
    'workshops',
    'workshop_series',
    'workshop_categories',
    'users',
  ];

  // Keep: daily_content, daily_content_translations, videos, video_categories, video_reactions,
  //       categories, platform_settings, bible_translations, SequelizeMeta

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tablesToWipe) {
    try {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`  Truncated: ${table}`);
    } catch (e) {
      console.log(`  Skip (not found): ${table} — ${e.message}`);
    }
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('  Wipe complete.\n');
}

// ─── Import: Users ───────────────────────────────────────────────────────────

async function importUsers(conn, sqlContent) {
  console.log('=== IMPORTING USERS ===');

  const oldUsers = parseTable(sqlContent, 'users');
  console.log(`  Parsed ${oldUsers.length} users from dump`);

  // Parse category_user_relations for mode derivation
  const catRelations = parseTable(sqlContent, 'category_user_relations');
  const userCategories = new Map(); // user_id -> Set of category_ids
  for (const rel of catRelations) {
    if (!userCategories.has(rel.user_id)) userCategories.set(rel.user_id, new Set());
    userCategories.get(rel.user_id).add(rel.category_id);
  }
  console.log(`  Parsed ${catRelations.length} category relations for mode derivation`);

  // Filter users with missing email, missing/empty username, or username > 30 chars
  const validUsers = oldUsers.filter(u => {
    if (!u.username || u.username.trim() === '' || u.username.length > 30) {
      stats.users.skipped++;
      return false;
    }
    if (!u.email || u.email.trim() === '') {
      stats.users.skipped++;
      return false;
    }
    return true;
  });
  console.log(`  Valid users after username filter: ${validUsers.length} (skipped ${stats.users.skipped})`);

  // Deduplicate usernames (case-insensitive — MySQL unique index is CI)
  const usernameSeen = new Map(); // lowercase -> count
  let dupFixed = 0;
  for (const u of validUsers) {
    const lower = u.username.toLowerCase();
    const count = (usernameSeen.get(lower) || 0) + 1;
    usernameSeen.set(lower, count);
    if (count > 1) {
      // Append user ID to make unique
      u.username = `${u.username}${u.id}`;
      if (u.username.length > 30) u.username = u.username.substring(0, 30);
      dupFixed++;
    }
  }
  console.log(`  Deduplicated ${dupFixed} usernames`);

  // Reserve 'freeluma' username for admin — rename any imported user who has it
  for (const u of validUsers) {
    if (u.username.toLowerCase() === 'freeluma') {
      u.username = `freeluma_old${u.id}`;
      console.log(`  Reserved 'freeluma' for admin — renamed user ${u.id} to '${u.username}'`);
    }
  }

  // Batch insert users
  const userBatches = chunk(validUsers, BATCH_SIZE);
  let batchNum = 0;

  for (const batch of userBatches) {
    batchNum++;
    const userValues = [];
    const settingsValues = [];

    for (const u of batch) {
      // Password transformation
      let passwordHash = u.password;
      if (passwordHash) {
        if (passwordHash.startsWith('$2y$')) {
          // PHP bcrypt -> Node bcrypt
          passwordHash = passwordHash.replace('$2y$', '$2b$');
        } else if (!passwordHash.startsWith('$2b$') && !passwordHash.startsWith('$2a$')) {
          // Plaintext password — hash it
          passwordHash = await bcrypt.hash(passwordHash, BCRYPT_ROUNDS);
        }
      }

      // Status: IDs 1-85 = deactivated test accounts, 86+ = active
      const status = u.id <= 85 ? 'deactivated' : 'active';

      // Mode derivation from category_user_relations
      // category_id 1 = BIBLE, 2 = POSITIVITY
      const cats = userCategories.get(u.id);
      let mode = 'bible'; // default
      if (cats) {
        if (cats.has(2) && !cats.has(1)) mode = 'positivity';
        // If has both or only 1, stays 'bible'
      }

      // Bible setting / preferred translation
      let preferredTranslation = u.bible_setting || 'KJV';
      if (preferredTranslation === 'FLP') preferredTranslation = 'KJV';
      // Ensure max 10 chars
      if (preferredTranslation.length > 10) preferredTranslation = preferredTranslation.substring(0, 10);

      // Date of birth - fix 0000-00-00
      let dob = u.dob;
      if (dob === '0000-00-00' || dob === '0000-00-00 00:00:00') dob = null;

      // Display name from first_name + last_name
      let displayName = ((u.first_name || '') + ' ' + (u.last_name || '')).trim();
      if (!displayName) displayName = u.username || 'User';
      if (displayName.length > 100) displayName = displayName.substring(0, 100);

      // Profile privacy
      const profilePrivacy = u.account_visibility === 'PRIVATE' ? 'private' : 'public';

      // Location from city + state + country
      const locationParts = [u.city, u.state, u.country].filter(Boolean).filter(s => s.trim());
      let location = locationParts.join(', ') || null;
      if (location && location.length > 200) location = location.substring(0, 200);

      // Avatar URL
      let avatarUrl = u.profile_picture;
      if (avatarUrl === 'default.jpg') avatarUrl = null;

      // Username sanitization (already filtered > 30)
      const username = u.username.substring(0, 30);

      // Email — ensure not empty
      if (!u.email) {
        stats.users.skipped++;
        continue;
      }

      // Phone
      let phone = u.phone || null;
      if (phone && phone.length > 20) phone = phone.substring(0, 20);
      if (phone === '') phone = null;

      // Language — default to 'en'
      const language = 'en';

      userValues.push([
        u.id,
        u.email,
        passwordHash,
        null, // google_id
        null, // apple_id
        displayName,
        username,
        avatarUrl,
        '#6366F1', // default avatar_color
        null, // bio
        null, // denomination
        null, // church
        null, // testimony
        profilePrivacy,
        location,
        null, // website
        phone,
        dob,
        mode,
        'America/New_York', // timezone
        preferredTranslation,
        language,
        1, // email_verified (assume existing users are verified)
        null, // email_verification_token
        1, // onboarding_complete
        0, // is_admin
        0, // is_verified
        'user', // role
        1, // can_host
        status,
        status === 'deactivated' ? u.createdAt : null, // deactivated_at
        null, // deletion_requested_at
        null, // last_login_at
        0, // failed_login_attempts
        null, // locked_until
        null, // deleted_at
        u.createdAt,
        u.updatedAt,
      ]);

      // user_settings
      let dailyReminderTime = '08:00';
      if (u.daily_post_notification_time) {
        // Convert TIME to HH:MM
        const timeParts = String(u.daily_post_notification_time).split(':');
        if (timeParts.length >= 2) {
          dailyReminderTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
        }
      }

      settingsValues.push([
        u.id, // user_id
        'system', // dark_mode
        1, // push_enabled
        1, // email_notifications
        dailyReminderTime,
        null, // quiet_hours_start
        null, // quiet_hours_end
        'mutual', // messaging_access
        1, // email_dm_notifications
        1, // email_follow_notifications
        1, // email_prayer_notifications
        1, // email_daily_reminder
        null, // reminder_timezone
        u.createdAt,
        u.updatedAt,
      ]);
    }

    if (userValues.length === 0) continue;

    if (!DRY_RUN) {
      await conn.query(
        `INSERT IGNORE INTO users (id, email, password_hash, google_id, apple_id, display_name, username,
          avatar_url, avatar_color, bio, denomination, church, testimony, profile_privacy,
          location, website, phone, date_of_birth, mode, timezone, preferred_translation,
          language, email_verified, email_verification_token, onboarding_complete, is_admin,
          is_verified, role, can_host, status, deactivated_at, deletion_requested_at,
          last_login_at, failed_login_attempts, locked_until, deleted_at, created_at, updated_at)
        VALUES ?`,
        [userValues]
      );

      await conn.query(
        `INSERT IGNORE INTO user_settings (user_id, dark_mode, push_enabled, email_notifications,
          daily_reminder_time, quiet_hours_start, quiet_hours_end, messaging_access,
          email_dm_notifications, email_follow_notifications, email_prayer_notifications,
          email_daily_reminder, reminder_timezone, created_at, updated_at)
        VALUES ?`,
        [settingsValues]
      );
    }

    stats.users.imported += userValues.length;
    stats.user_settings.imported += settingsValues.length;
    process.stdout.write(`  Batch ${batchNum}/${userBatches.length}: ${userValues.length} users\r`);
  }

  console.log(`\n  Users imported: ${stats.users.imported}, skipped: ${stats.users.skipped}`);

  // Import liked_posts -> post_reactions
  console.log('  Importing liked_posts JSON -> post_reactions...');
  let likedPostsCount = 0;
  for (const u of validUsers) {
    if (!u.liked_posts || u.liked_posts === '[]') continue;
    try {
      const postIds = JSON.parse(u.liked_posts);
      if (!Array.isArray(postIds) || postIds.length === 0) continue;
      for (const postId of postIds) {
        // Will be inserted after posts are imported (deferred)
        // We track them for later
      }
      likedPostsCount += postIds.length;
    } catch (e) {
      // Skip invalid JSON
    }
  }
  console.log(`  (liked_posts deferred — ${likedPostsCount} reactions to import after posts)`);

  return validUsers;
}

// ─── Import: Posts ───────────────────────────────────────────────────────────

async function importPosts(conn, sqlContent, importedUserIds) {
  console.log('\n=== IMPORTING POSTS ===');

  const oldPosts = parseTable(sqlContent, 'posts');
  console.log(`  Parsed ${oldPosts.length} posts from dump`);

  const postValues = [];
  const mediaValues = [];
  const prayerValues = [];
  const postIdMap = new Map(); // old_id -> new_id (same since we keep IDs)

  for (const p of oldPosts) {
    // Skip soft-deleted
    if (p.is_deleted === 1) {
      stats.posts.skipped++;
      continue;
    }

    // Skip if user doesn't exist
    if (!importedUserIds.has(p.user_id)) {
      stats.posts.skipped++;
      continue;
    }

    // Post type mapping
    let postType = 'text';
    if (p.post_type === 'PRAYER_WALL') postType = 'prayer_request';

    // Mode from category_id: 1=BIBLE, 2=POSITIVITY
    let mode = 'bible';
    if (p.category_id === 2) mode = 'positivity';

    // Strip HTML from text content
    const body = stripHtml(p.text_content) || '';

    postValues.push([
      p.id,
      p.user_id,
      body,
      postType,
      'public', // visibility
      mode,
      p.is_updated ? 1 : 0, // edited
      0, // is_anonymous
      0, // flagged
      0, // hidden
      null, // deleted_at
      p.createdAt,
      p.updatedAt,
    ]);
    postIdMap.set(p.id, p.id);

    // Parse media JSON
    if (p.media) {
      try {
        const mediaArr = JSON.parse(p.media);
        if (Array.isArray(mediaArr)) {
          let sortOrder = 0;
          for (const m of mediaArr) {
            const mediaUrl = typeof m === 'string' ? m : (m.file_name || m.filename || m.url || null);
            if (!mediaUrl) continue;
            // Determine media type from file_type field or extension
            let mediaType = 'image';
            if (typeof m === 'object' && m.file_type) {
              mediaType = m.file_type === 'video' ? 'video' : 'image';
            } else {
              const ext = mediaUrl.toLowerCase().split('.').pop();
              if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) mediaType = 'video';
            }

            mediaValues.push([
              p.id, // post_id
              mediaUrl, // url
              mediaType,
              null, // thumbnail_url
              null, // width
              null, // height
              null, // duration
              sortOrder++,
              p.createdAt,
              p.updatedAt,
            ]);
          }
        }
      } catch (e) {
        // Invalid JSON, skip media
      }
    }

    // Prayer request
    if (postType === 'prayer_request') {
      prayerValues.push([
        p.id, // post_id
        'public', // privacy
        'active', // status
        null, // answered_at
        null, // answered_testimony
        0, // pray_count
        p.createdAt,
        p.updatedAt,
      ]);
    }
  }

  if (postValues.length > 0 && !DRY_RUN) {
    for (const batch of chunk(postValues, BATCH_SIZE)) {
      await conn.query(
        `INSERT INTO posts (id, user_id, body, post_type, visibility, mode, edited, is_anonymous,
          flagged, hidden, deleted_at, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
    stats.posts.imported = postValues.length;

    if (mediaValues.length > 0) {
      for (const batch of chunk(mediaValues, BATCH_SIZE)) {
        await conn.query(
          `INSERT INTO post_media (post_id, url, media_type, thumbnail_url, width, height,
            duration, sort_order, created_at, updated_at)
          VALUES ?`,
          [batch]
        );
      }
      stats.post_media.imported = mediaValues.length;
    }

    if (prayerValues.length > 0) {
      for (const batch of chunk(prayerValues, BATCH_SIZE)) {
        await conn.query(
          `INSERT INTO prayer_requests (post_id, privacy, status, answered_at,
            answered_testimony, pray_count, created_at, updated_at)
          VALUES ?`,
          [batch]
        );
      }
      stats.prayer_requests.imported = prayerValues.length;
    }
  }

  console.log(`  Posts: ${stats.posts.imported}, Media: ${stats.post_media.imported}, Prayer: ${stats.prayer_requests.imported}, Skipped: ${stats.posts.skipped}`);
  return postIdMap;
}

// ─── Import: Post Reactions (liked_posts JSON) ───────────────────────────────

async function importPostReactions(conn, sqlContent, importedUserIds, postIdMap) {
  console.log('\n=== IMPORTING POST REACTIONS (liked_posts) ===');

  const oldUsers = parseTable(sqlContent, 'users');
  const reactionValues = [];
  const seen = new Set(); // dedup (user_id, post_id)

  for (const u of oldUsers) {
    if (!importedUserIds.has(u.id)) continue;
    if (!u.liked_posts || u.liked_posts === '[]') continue;
    try {
      const postIds = JSON.parse(u.liked_posts);
      if (!Array.isArray(postIds)) continue;
      for (const pid of postIds) {
        const postId = Number(pid);
        if (!postIdMap.has(postId)) continue;
        const key = `${u.id}-${postId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        reactionValues.push([
          u.id,
          postId,
          'love',
          u.updatedAt,
          u.updatedAt,
        ]);
      }
    } catch (e) { /* skip */ }
  }

  if (reactionValues.length > 0 && !DRY_RUN) {
    for (const batch of chunk(reactionValues, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO post_reactions (user_id, post_id, reaction_type, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
  stats.post_reactions.imported = reactionValues.length;
  console.log(`  Post reactions: ${stats.post_reactions.imported}`);
}

// ─── Import: Post Comments ───────────────────────────────────────────────────

async function importPostComments(conn, sqlContent, importedUserIds, postIdMap) {
  console.log('\n=== IMPORTING POST COMMENTS ===');

  const oldComments = parseTable(sqlContent, 'comments');
  console.log(`  Parsed ${oldComments.length} comments from dump`);

  const commentValues = [];
  const commentIdSet = new Set();

  for (const c of oldComments) {
    // Skip soft-deleted
    if (c.is_deleted === 1) {
      stats.post_comments.skipped++;
      continue;
    }
    if (!importedUserIds.has(c.user_id)) {
      stats.post_comments.skipped++;
      continue;
    }
    if (!postIdMap.has(c.post_id)) {
      stats.post_comments.skipped++;
      continue;
    }

    // parent_id: 0 -> NULL
    const parentId = c.parent_id === 0 ? null : c.parent_id;

    const body = stripHtml(c.text_content) || '';

    commentValues.push([
      c.id,
      c.user_id,
      c.post_id,
      parentId,
      body,
      0, // edited
      0, // flagged
      0, // hidden
      c.createdAt,
      c.updatedAt,
    ]);
    commentIdSet.add(c.id);
  }

  if (commentValues.length > 0 && !DRY_RUN) {
    // First pass: insert comments without parent_id to avoid FK issues
    const rootComments = commentValues.filter(v => v[3] === null);
    const childComments = commentValues.filter(v => v[3] !== null);

    for (const batch of chunk(rootComments, BATCH_SIZE)) {
      await conn.query(
        `INSERT INTO post_comments (id, user_id, post_id, parent_id, body, edited, flagged, hidden,
          created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }

    // Second pass: child comments (only if parent exists)
    const validChildren = childComments.filter(v => commentIdSet.has(v[3]));
    for (const batch of chunk(validChildren, BATCH_SIZE)) {
      await conn.query(
        `INSERT INTO post_comments (id, user_id, post_id, parent_id, body, edited, flagged, hidden,
          created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }

    stats.post_comments.imported = rootComments.length + validChildren.length;
    stats.post_comments.skipped += childComments.length - validChildren.length;
  }

  console.log(`  Comments: ${stats.post_comments.imported}, Skipped: ${stats.post_comments.skipped}`);
  return commentIdSet;
}

// ─── Import: Post Comment Reactions ──────────────────────────────────────────

async function importPostCommentReactions(conn, sqlContent, importedUserIds, commentIdSet) {
  console.log('\n=== IMPORTING POST COMMENT REACTIONS ===');

  const oldReactions = parseTable(sqlContent, 'usercomments');
  console.log(`  Parsed ${oldReactions.length} comment reactions from dump`);

  const values = [];
  for (const r of oldReactions) {
    if (r.is_liked !== 1) {
      stats.post_comment_reactions.skipped++;
      continue;
    }
    if (!importedUserIds.has(r.user_id)) {
      stats.post_comment_reactions.skipped++;
      continue;
    }
    if (!commentIdSet.has(r.comment_id)) {
      stats.post_comment_reactions.skipped++;
      continue;
    }

    values.push([
      r.user_id,
      r.comment_id,
      'love',
      r.createdAt,
      r.updatedAt,
    ]);
  }

  if (values.length > 0 && !DRY_RUN) {
    for (const batch of chunk(values, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO post_comment_reactions (user_id, comment_id, reaction_type, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
  stats.post_comment_reactions.imported = values.length;
  console.log(`  Comment reactions: ${stats.post_comment_reactions.imported}, Skipped: ${stats.post_comment_reactions.skipped}`);
}

// ─── Import: Follows ─────────────────────────────────────────────────────────

async function importFollows(conn, sqlContent, importedUserIds) {
  console.log('\n=== IMPORTING FOLLOWS ===');

  const oldFollows = parseTable(sqlContent, 'follows');
  console.log(`  Parsed ${oldFollows.length} follows from dump`);

  const values = [];
  const seen = new Set();

  for (const f of oldFollows) {
    if (!importedUserIds.has(f.follower_id) || !importedUserIds.has(f.following_id)) {
      stats.follows.skipped++;
      continue;
    }
    // Self-follow skip
    if (f.follower_id === f.following_id) {
      stats.follows.skipped++;
      continue;
    }
    // Dedup
    const key = `${f.follower_id}-${f.following_id}`;
    if (seen.has(key)) {
      stats.follows.skipped++;
      continue;
    }
    seen.add(key);

    // Status: old 1->active, 0->pending
    const status = f.status === 1 ? 'active' : 'pending';

    values.push([
      f.id,
      f.follower_id,
      f.following_id,
      status,
      f.createdAt,
      f.updatedAt,
    ]);
  }

  if (values.length > 0 && !DRY_RUN) {
    for (const batch of chunk(values, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO follows (id, follower_id, following_id, status, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
  stats.follows.imported = values.length;
  console.log(`  Follows: ${stats.follows.imported}, Skipped: ${stats.follows.skipped}`);
}

// ─── Import: Chats -> Conversations + Messages ──────────────────────────────

async function importChats(conn, sqlContent, importedUserIds) {
  console.log('\n=== IMPORTING CHATS ===');

  const oldChats = parseTable(sqlContent, 'chats');
  console.log(`  Parsed ${oldChats.length} chat messages from dump`);

  // Group chats by conversation pair (min_id, max_id)
  const convMap = new Map(); // "minId-maxId" -> sorted messages

  for (const c of oldChats) {
    if (!importedUserIds.has(c.sender_id) || !importedUserIds.has(c.receiver_id)) continue;
    // Skip self-messages
    if (c.sender_id === c.receiver_id) continue;
    const minId = Math.min(c.sender_id, c.receiver_id);
    const maxId = Math.max(c.sender_id, c.receiver_id);
    const key = `${minId}-${maxId}`;
    if (!convMap.has(key)) convMap.set(key, []);
    convMap.get(key).push(c);
  }

  // Sort each conversation's messages by date
  for (const [, msgs] of convMap) {
    msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  console.log(`  Grouped into ${convMap.size} conversations`);

  if (DRY_RUN) {
    stats.conversations.imported = convMap.size;
    console.log(`  [DRY RUN] Would create ${convMap.size} conversations`);
    return;
  }

  let convId = 0;
  for (const [key, msgs] of convMap) {
    const [minId, maxId] = key.split('-').map(Number);
    const firstMsg = msgs[0];
    const lastMsg = msgs[msgs.length - 1];

    // Create conversation
    convId++;
    await conn.query(
      `INSERT INTO conversations (id, type, name, avatar_url, creator_id, last_message_at, created_at, updated_at)
      VALUES (?, 'direct', NULL, NULL, ?, ?, ?, ?)`,
      [convId, firstMsg.sender_id, lastMsg.createdAt, firstMsg.createdAt, lastMsg.updatedAt]
    );
    stats.conversations.imported++;

    // Create participants
    // Find last_read_at for each participant
    let lastReadMinId = null;
    let lastReadMaxId = null;
    for (const m of msgs) {
      if (m.is_seen === 1) {
        // The receiver has read up to this message
        const receiverId = m.receiver_id;
        if (receiverId === minId) {
          if (!lastReadMinId || new Date(m.createdAt) > new Date(lastReadMinId)) lastReadMinId = m.createdAt;
        } else {
          if (!lastReadMaxId || new Date(m.createdAt) > new Date(lastReadMaxId)) lastReadMaxId = m.createdAt;
        }
      }
    }

    await conn.query(
      `INSERT IGNORE INTO conversation_participants (conversation_id, user_id, role, last_read_at, joined_at, created_at, updated_at)
      VALUES (?, ?, 'member', ?, ?, ?, ?), (?, ?, 'member', ?, ?, ?, ?)`,
      [
        convId, minId, lastReadMinId, firstMsg.createdAt, firstMsg.createdAt, lastMsg.updatedAt,
        convId, maxId, lastReadMaxId, firstMsg.createdAt, firstMsg.createdAt, lastMsg.updatedAt,
      ]
    );
    stats.conversation_participants.imported += 2;

    // Insert messages
    let lastMessageId = null;
    for (const m of msgs) {
      // Message type mapping
      let msgType = 'text';
      if (m.message_type === 'IMAGE' || m.message_type === 'VIDEO') msgType = 'media';
      else if (m.message_type === 'AUDIO') msgType = 'voice';

      const content = msgType === 'text' ? (m.message || '') : null;

      const [result] = await conn.query(
        `INSERT INTO messages (conversation_id, sender_id, type, content, reply_to_id, shared_post_id,
          shared_video_id, is_unsent, flagged, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)`,
        [convId, m.sender_id, msgType, content, m.createdAt, m.updatedAt]
      );
      const messageId = result.insertId;
      lastMessageId = messageId;
      stats.messages.imported++;

      // Media attachment
      if (m.media && (msgType === 'media' || msgType === 'voice')) {
        let mediaType = 'image';
        if (m.message_type === 'VIDEO') mediaType = 'video';
        else if (m.message_type === 'AUDIO') mediaType = 'voice';

        await conn.query(
          `INSERT INTO message_media (message_id, media_url, media_type, duration, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, NULL, 0, ?, ?)`,
          [messageId, m.media, mediaType, m.createdAt, m.updatedAt]
        );
        stats.message_media.imported++;
      }

      // Message status (for receiver if seen)
      if (m.is_seen === 1) {
        await conn.query(
          `INSERT INTO message_status (message_id, user_id, status, status_at)
          VALUES (?, ?, 'read', ?)`,
          [messageId, m.receiver_id, m.updatedAt]
        );
        stats.message_status.imported++;
      }
    }

    // Update conversation with last_message_id
    if (lastMessageId) {
      await conn.query(
        'UPDATE conversations SET last_message_id = ? WHERE id = ?',
        [lastMessageId, convId]
      );
    }
  }

  console.log(`  Conversations: ${stats.conversations.imported}, Participants: ${stats.conversation_participants.imported}`);
  console.log(`  Messages: ${stats.messages.imported}, Media: ${stats.message_media.imported}, Status: ${stats.message_status.imported}`);
}

// ─── Import: Daily Content Comments ──────────────────────────────────────────

async function importDailyComments(conn, sqlContent, importedUserIds) {
  console.log('\n=== IMPORTING DAILY COMMENTS ===');

  // Build dailypost ID -> date mapping from old dump
  const oldDailyPosts = parseTable(sqlContent, 'dailyposts');
  const dailyPostDateMap = new Map(); // old_id -> date string
  for (const dp of oldDailyPosts) {
    dailyPostDateMap.set(dp.id, dp.daily_post_name);
  }
  console.log(`  Built dailypost date map: ${dailyPostDateMap.size} entries`);

  // Build date -> new daily_content_id mapping (English entries only)
  const [dcRows] = await conn.query(
    "SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') as post_date FROM daily_content WHERE language = 'en'"
  );
  const dateToContentId = new Map();
  for (const row of dcRows) {
    dateToContentId.set(row.post_date, row.id);
  }
  console.log(`  New daily_content English entries: ${dateToContentId.size}`);

  // Parse old daily comments
  const oldComments = parseTable(sqlContent, 'dailypostcomments');
  console.log(`  Parsed ${oldComments.length} daily comments from dump`);

  const commentValues = [];
  const commentIdMap = new Map(); // old_id -> new info for reactions

  for (const c of oldComments) {
    // Skip soft-deleted
    if (c.is_deleted === 1) {
      stats.daily_comments.skipped++;
      continue;
    }
    if (!importedUserIds.has(c.user_id)) {
      stats.daily_comments.skipped++;
      continue;
    }

    // Resolve daily_content_id
    const dateStr = dailyPostDateMap.get(c.daily_post_id);
    if (!dateStr) {
      stats.daily_comments.skipped++;
      continue;
    }
    const contentId = dateToContentId.get(dateStr);
    if (!contentId) {
      stats.daily_comments.skipped++;
      continue;
    }

    // parent_id: 0 -> NULL
    const parentId = c.parent_id === 0 ? null : c.parent_id;

    const body = stripHtml(c.text_content) || '';

    commentValues.push([
      c.id,
      c.user_id,
      contentId,
      parentId,
      body,
      0, // edited
      c.createdAt,
      c.updatedAt,
    ]);
    commentIdMap.set(c.id, true);
  }

  if (commentValues.length > 0 && !DRY_RUN) {
    // Root comments first (no parent)
    const roots = commentValues.filter(v => v[3] === null);
    const children = commentValues.filter(v => v[3] !== null);

    for (const batch of chunk(roots, BATCH_SIZE)) {
      await conn.query(
        `INSERT INTO daily_comments (id, user_id, daily_content_id, parent_id, body, edited,
          created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }

    // Children — only if parent exists
    const validChildren = children.filter(v => commentIdMap.has(v[3]));
    for (const batch of chunk(validChildren, BATCH_SIZE)) {
      await conn.query(
        `INSERT INTO daily_comments (id, user_id, daily_content_id, parent_id, body, edited,
          created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }

    stats.daily_comments.imported = roots.length + validChildren.length;
    stats.daily_comments.skipped += children.length - validChildren.length;
  }

  console.log(`  Daily comments: ${stats.daily_comments.imported}, Skipped: ${stats.daily_comments.skipped}`);
  return commentIdMap;
}

// ─── Import: Daily Reactions + Bookmarks ─────────────────────────────────────

async function importDailyReactionsAndBookmarks(conn, sqlContent, importedUserIds) {
  console.log('\n=== IMPORTING DAILY REACTIONS & BOOKMARKS ===');

  // Build dailypost ID -> date mapping
  const oldDailyPosts = parseTable(sqlContent, 'dailyposts');
  const dailyPostDateMap = new Map();
  for (const dp of oldDailyPosts) {
    dailyPostDateMap.set(dp.id, dp.daily_post_name);
  }

  // Build date -> daily_content_id mapping
  const [dcRows] = await conn.query(
    "SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') as post_date FROM daily_content WHERE language = 'en'"
  );
  const dateToContentId = new Map();
  for (const row of dcRows) {
    dateToContentId.set(row.post_date, row.id);
  }

  const oldDailyUsers = parseTable(sqlContent, 'dailypostusers');
  console.log(`  Parsed ${oldDailyUsers.length} daily user records from dump`);

  const reactionValues = [];
  const bookmarkValues = [];
  const seenReactions = new Set();
  const seenBookmarks = new Set();

  for (const du of oldDailyUsers) {
    if (!importedUserIds.has(du.user_id)) continue;

    const dateStr = dailyPostDateMap.get(du.daily_post_id);
    if (!dateStr) continue;
    const contentId = dateToContentId.get(dateStr);
    if (!contentId) continue;

    // is_liked -> daily_reactions
    if (du.is_liked === 1) {
      const key = `${du.user_id}-${contentId}`;
      if (!seenReactions.has(key)) {
        seenReactions.add(key);
        reactionValues.push([
          du.user_id,
          contentId,
          'love',
          du.createdAt,
          du.updatedAt,
        ]);
      }
    }

    // is_bookmarked -> bookmarks
    if (du.is_bookmarked === 1) {
      const key = `${du.user_id}-${contentId}`;
      if (!seenBookmarks.has(key)) {
        seenBookmarks.add(key);
        bookmarkValues.push([
          du.user_id,
          null, // post_id
          contentId, // daily_content_id
          du.createdAt,
          du.updatedAt,
        ]);
      }
    }
  }

  if (reactionValues.length > 0 && !DRY_RUN) {
    for (const batch of chunk(reactionValues, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO daily_reactions (user_id, daily_content_id, reaction_type, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
  stats.daily_reactions.imported = reactionValues.length;

  if (bookmarkValues.length > 0 && !DRY_RUN) {
    for (const batch of chunk(bookmarkValues, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO bookmarks (user_id, post_id, daily_content_id, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
  stats.bookmarks.imported = bookmarkValues.length;

  console.log(`  Daily reactions: ${stats.daily_reactions.imported}, Bookmarks: ${stats.bookmarks.imported}`);
}

// ─── Import: Daily Comment Reactions ─────────────────────────────────────────

async function importDailyCommentReactions(conn, sqlContent, importedUserIds, commentIdMap) {
  console.log('\n=== IMPORTING DAILY COMMENT REACTIONS ===');

  const oldReactions = parseTable(sqlContent, 'dailypostusercomments');
  console.log(`  Parsed ${oldReactions.length} daily comment reactions from dump`);

  const values = [];
  const seen = new Set();

  for (const r of oldReactions) {
    if (r.is_liked !== 1) {
      stats.daily_comment_reactions.skipped++;
      continue;
    }
    if (!importedUserIds.has(r.user_id)) {
      stats.daily_comment_reactions.skipped++;
      continue;
    }
    if (!commentIdMap.has(r.comment_id)) {
      stats.daily_comment_reactions.skipped++;
      continue;
    }
    const key = `${r.user_id}-${r.comment_id}`;
    if (seen.has(key)) {
      stats.daily_comment_reactions.skipped++;
      continue;
    }
    seen.add(key);

    values.push([
      r.comment_id,
      r.user_id,
      r.createdAt,
      r.updatedAt,
    ]);
  }

  if (values.length > 0 && !DRY_RUN) {
    for (const batch of chunk(values, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO daily_comment_reactions (comment_id, user_id, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
  stats.daily_comment_reactions.imported = values.length;
  console.log(`  Daily comment reactions: ${stats.daily_comment_reactions.imported}, Skipped: ${stats.daily_comment_reactions.skipped}`);
}

// ─── Seed Admin/Test User ────────────────────────────────────────────────────

async function seedAdminAndTestUser(conn) {
  console.log('\n=== SEEDING ADMIN & TEST USER ===');

  // Find max user ID
  const [maxResult] = await conn.query('SELECT MAX(id) as maxId FROM users');
  const maxId = maxResult[0].maxId || 0;
  const adminId = maxId + 1;
  const testUserId = maxId + 2;

  const adminHash = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
  const testHash = await bcrypt.hash('test123', BCRYPT_ROUNDS);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (!DRY_RUN) {
    // Use unique usernames that won't clash with imported data
    await conn.query(
      `INSERT INTO users (id, email, password_hash, display_name, username, avatar_color, mode,
        timezone, preferred_translation, language, email_verified, onboarding_complete,
        is_admin, is_verified, role, can_host, status, created_at, updated_at)
      VALUES
        (?, 'admin@freeluma.com', ?, 'Free Luma', 'freeluma', '#6366F1', 'bible',
          'America/New_York', 'KJV', 'en', 1, 1, 1, 1, 'admin', 1, 'active', ?, ?),
        (?, 'testuser@freeluma.com', ?, 'Test User', 'fl_testuser', '#6366F1', 'bible',
          'America/New_York', 'KJV', 'en', 1, 1, 0, 0, 'user', 1, 'active', ?, ?)`,
      [adminId, adminHash, now, now, testUserId, testHash, now, now]
    );

    // Create user_settings for both
    await conn.query(
      `INSERT INTO user_settings (user_id, dark_mode, push_enabled, email_notifications,
        daily_reminder_time, messaging_access, email_dm_notifications, email_follow_notifications,
        email_prayer_notifications, email_daily_reminder, created_at, updated_at)
      VALUES (?, 'system', 1, 1, '08:00', 'mutual', 1, 1, 1, 1, ?, ?),
             (?, 'system', 1, 1, '08:00', 'mutual', 1, 1, 1, 1, ?, ?)`,
      [adminId, now, now, testUserId, now, now]
    );
  }

  console.log(`  Admin: ID ${adminId} (admin@freeluma.com / freeluma / admin123 / verified)`);
  console.log(`  Test:  ID ${testUserId} (testuser@freeluma.com / fl_testuser / test123)`);
}

// ─── Re-import Pre-Migration Seed Posts ──────────────────────────────────────

/**
 * Parses a mysqldump-style VALUES-only INSERT (no column names) using a
 * string-aware parser that handles semicolons, escaped quotes, etc.
 */
function parseValuesOnly(sql, startKeyword) {
  const idx = sql.indexOf(startKeyword);
  if (idx === -1) return [];

  // Find the string-aware end of the INSERT statement
  let inString = false;
  let endIdx = -1;
  for (let i = idx; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === "'") {
        if (i + 1 < sql.length && sql[i + 1] === "'") { i++; continue; }
        inString = false;
      }
      continue;
    }
    if (ch === "'") { inString = true; continue; }
    if (ch === ';') { endIdx = i; break; }
  }
  if (endIdx === -1) return [];

  const block = sql.substring(idx, endIdx + 1);

  // Find VALUES keyword
  const vIdx = block.indexOf('VALUES');
  if (vIdx === -1) return [];

  // Parse tuples from the VALUES section
  const rows = [];
  let pos = vIdx + 6;

  while (pos < block.length) {
    while (pos < block.length && /[\s,]/.test(block[pos])) pos++;
    if (block[pos] !== '(') break;
    pos++; // skip (

    const values = [];
    let valueStart = pos;
    let strMode = false;
    let depth = 0;

    while (pos < block.length) {
      const ch = block[pos];
      if (strMode) {
        if (ch === '\\') { pos += 2; continue; }
        if (ch === "'") {
          if (pos + 1 < block.length && block[pos + 1] === "'") { pos += 2; continue; }
          strMode = false;
        }
        pos++;
        continue;
      }
      if (ch === "'") { strMode = true; pos++; continue; }
      if (ch === '(') { depth++; pos++; continue; }
      if (ch === ')') {
        if (depth > 0) { depth--; pos++; continue; }
        values.push(parseSeedValue(block.substring(valueStart, pos).trim()));
        pos++;
        break;
      }
      if (ch === ',' && depth === 0) {
        values.push(parseSeedValue(block.substring(valueStart, pos).trim()));
        pos++;
        valueStart = pos;
        continue;
      }
      pos++;
    }

    if (values.length > 0) rows.push(values);

    while (pos < block.length && /[\s,]/.test(block[pos])) pos++;
    if (block[pos] === ';') break;
  }

  return rows;
}

function parseSeedValue(raw) {
  if (raw === 'NULL') return null;
  if (raw.startsWith("'") && raw.endsWith("'")) {
    let s = raw.slice(1, -1);
    s = s.replace(/''/g, "'");
    s = s.replace(/\\'/g, "'");
    s = s.replace(/\\"/g, '"');
    s = s.replace(/\\\\/g, '\\');
    s = s.replace(/\\n/g, '\n');
    s = s.replace(/\\r/g, '\r');
    s = s.replace(/\\t/g, '\t');
    s = s.replace(/\\0/g, '\0');
    return s;
  }
  const num = Number(raw);
  if (!isNaN(num) && raw !== '') return num;
  return raw;
}

async function reimportSeedPosts(conn) {
  console.log('\n=== RE-IMPORTING SEED POSTS FROM PRE-MIGRATION BACKUP ===');

  if (!fs.existsSync(PRE_MIGRATION_PATH)) {
    console.log('  Pre-migration backup not found, skipping.');
    return;
  }

  const preSql = fs.readFileSync(PRE_MIGRATION_PATH, 'utf8');
  console.log(`  Read pre-migration backup: ${(preSql.length / 1024 / 1024).toFixed(1)} MB`);

  // Get admin user ID
  const [adminRows] = await conn.query("SELECT id FROM users WHERE email = 'admin@freeluma.com'");
  if (adminRows.length === 0) {
    console.log('  Admin user not found, skipping.');
    return;
  }
  const adminId = adminRows[0].id;
  console.log(`  Admin user ID: ${adminId}`);

  // Get current max post ID to offset new IDs
  const [maxPostRows] = await conn.query('SELECT MAX(id) as m FROM posts');
  const currentMaxPostId = maxPostRows[0].m || 0;

  // Parse seed posts — column order: id, user_id, body, post_type, visibility, mode,
  //   edited, is_anonymous, flagged, hidden, deleted_at, created_at, updated_at
  const seedPosts = parseValuesOnly(preSql, "INSERT INTO `posts` VALUES");
  console.log(`  Found ${seedPosts.length} seed posts`);

  // Parse seed prayer_requests — column order: id, post_id, privacy, status,
  //   answered_at, answered_testimony, pray_count, created_at, updated_at
  const seedPrayers = parseValuesOnly(preSql, "INSERT INTO `prayer_requests` VALUES");
  console.log(`  Found ${seedPrayers.length} seed prayer requests`);

  // Parse seed post_media — column order: id, post_id, media_type, url,
  //   thumbnail_url, width, height, duration, sort_order, created_at, updated_at
  const seedMedia = parseValuesOnly(preSql, "INSERT INTO `post_media` VALUES");
  console.log(`  Found ${seedMedia.length} seed post media`);

  // Build old_post_id -> new_post_id mapping
  const postIdMap = new Map();
  const postValues = [];

  for (const row of seedPosts) {
    const [oldId, , body, postType, visibility, mode, edited, isAnonymous, flagged, hidden, deletedAt, createdAt, updatedAt] = row;
    const newId = currentMaxPostId + oldId;
    postIdMap.set(oldId, newId);

    postValues.push([
      newId,
      adminId, // reassign to admin
      body,
      postType,
      visibility,
      mode,
      edited,
      isAnonymous,
      flagged,
      hidden,
      deletedAt,
      createdAt,
      updatedAt,
    ]);
  }

  if (postValues.length > 0 && !DRY_RUN) {
    await conn.query(
      `INSERT INTO posts (id, user_id, body, post_type, visibility, mode, edited, is_anonymous,
        flagged, hidden, deleted_at, created_at, updated_at)
      VALUES ?`,
      [postValues]
    );
    console.log(`  Inserted ${postValues.length} seed posts (IDs ${currentMaxPostId + 1}–${currentMaxPostId + seedPosts.length})`);
  }

  // Re-insert prayer_requests with updated post_id
  const prayerValues = [];
  for (const row of seedPrayers) {
    const [, oldPostId, privacy, status, answeredAt, answeredTestimony, prayCount, createdAt, updatedAt] = row;
    const newPostId = postIdMap.get(oldPostId);
    if (!newPostId) continue;

    prayerValues.push([
      newPostId,
      privacy,
      status,
      answeredAt,
      answeredTestimony,
      prayCount,
      createdAt,
      updatedAt,
    ]);
  }

  if (prayerValues.length > 0 && !DRY_RUN) {
    await conn.query(
      `INSERT INTO prayer_requests (post_id, privacy, status, answered_at, answered_testimony,
        pray_count, created_at, updated_at)
      VALUES ?`,
      [prayerValues]
    );
    console.log(`  Inserted ${prayerValues.length} seed prayer requests`);
  }

  // Re-insert post_media with updated post_id
  const mediaValues = [];
  for (const row of seedMedia) {
    const [, oldPostId, mediaType, url, thumbnailUrl, width, height, duration, sortOrder, createdAt, updatedAt] = row;
    const newPostId = postIdMap.get(oldPostId);
    if (!newPostId) continue;

    mediaValues.push([
      newPostId,
      mediaType,
      url,
      thumbnailUrl,
      width,
      height,
      duration,
      sortOrder,
      createdAt,
      updatedAt,
    ]);
  }

  if (mediaValues.length > 0 && !DRY_RUN) {
    await conn.query(
      `INSERT INTO post_media (post_id, media_type, url, thumbnail_url, width, height,
        duration, sort_order, created_at, updated_at)
      VALUES ?`,
      [mediaValues]
    );
    console.log(`  Inserted ${mediaValues.length} seed post media`);
  }

  // Re-insert reposts — schema: id, user_id, post_id, quote_post_id, created_at, updated_at
  const seedReposts = parseValuesOnly(preSql, "INSERT INTO `reposts` VALUES");
  console.log(`  Found ${seedReposts.length} seed reposts`);

  if (seedReposts.length > 0 && !DRY_RUN) {
    const repostValues = [];
    for (const row of seedReposts) {
      const [, , oldPostId, oldQuotePostId, createdAt, updatedAt] = row;
      const newPostId = postIdMap.get(oldPostId);
      const newQuotePostId = postIdMap.get(oldQuotePostId);
      if (!newPostId || !newQuotePostId) continue;

      repostValues.push([
        adminId, // user_id
        newPostId, // original post being reposted
        newQuotePostId, // the repost entry
        createdAt,
        updatedAt,
      ]);
    }

    if (repostValues.length > 0) {
      await conn.query(
        `INSERT INTO reposts (user_id, post_id, quote_post_id, created_at, updated_at)
        VALUES ?`,
        [repostValues]
      );
      console.log(`  Inserted ${repostValues.length} seed reposts`);
    }
  }

  // Copy old admin profile info to the new admin user
  // Old admin was user ID 2 in pre-migration backup
  // Column order: id, email, password_hash, google_id, apple_id, display_name, username,
  //   avatar_url, avatar_color, bio, denomination, church, testimony, profile_privacy,
  //   location, website, date_of_birth, mode, timezone, preferred_translation, language,
  //   email_verified, email_verification_token, onboarding_complete, is_admin, is_verified,
  //   role, can_host, status, deactivated_at, deletion_requested_at, last_login_at,
  //   failed_login_attempts, locked_until, deleted_at, created_at, updated_at
  const seedUsers = parseValuesOnly(preSql, "INSERT INTO `users` VALUES");
  const oldAdmin = seedUsers.find(row => row[0] === 2 || row[1] === 'admin@freeluma.com');
  if (oldAdmin && !DRY_RUN) {
    const [, , oldPasswordHash, , , displayName, , avatarUrl, avatarColor, bio,
      denomination, church, testimony, profilePrivacy, location, website,
      dateOfBirth, mode, timezone, preferredTranslation] = oldAdmin;

    await conn.query(
      `UPDATE users SET
        password_hash = ?, display_name = ?, avatar_url = ?, avatar_color = ?,
        bio = ?, denomination = ?, church = ?, testimony = ?, profile_privacy = ?,
        location = ?, website = ?, date_of_birth = ?, mode = ?, timezone = ?,
        preferred_translation = ?
      WHERE id = ?`,
      [oldPasswordHash, displayName, avatarUrl, avatarColor, bio, denomination,
        church, testimony, profilePrivacy, location, website, dateOfBirth,
        mode, timezone, preferredTranslation, adminId]
    );
    console.log(`  Updated admin profile from old admin (display: "${displayName}", avatar, bio, etc.)`);
  }

  console.log('  Seed post re-import complete.');
}

// ─── Import: Activation Codes from Legacy Text File ─────────────────────────

async function importActivationCodes(conn) {
  console.log('\n=== IMPORTING ACTIVATION CODES ===');

  if (!fs.existsSync(ACTIVATION_CODES_PATH)) {
    console.log('  WARNING: Activation codes file not found, skipping.');
    console.log(`  Expected: ${ACTIVATION_CODES_PATH}`);
    return;
  }

  const content = fs.readFileSync(ACTIVATION_CODES_PATH, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  console.log(`  Parsed ${lines.length} lines from activation_codes.txt`);

  const codeValues = [];
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  for (const line of lines) {
    // Format: "19401 - 7216-7538-2454"
    const dashIdx = line.indexOf(' - ');
    if (dashIdx === -1) {
      stats.activation_codes.skipped++;
      continue;
    }
    const code = line.substring(dashIdx + 3).trim();
    if (!code || code.length < 10) {
      stats.activation_codes.skipped++;
      continue;
    }

    codeValues.push([
      code,          // code (XXXX-XXXX-XXXX, 14 chars with dashes)
      0,             // used = false
      null,          // used_by
      null,          // used_at
      null,          // mode_hint
      '9999-12-31 00:00:00', // expires_at (never expire)
      null,          // created_by
      'imported',    // source
      now,           // created_at
      now,           // updated_at
    ]);
  }

  console.log(`  Valid codes to import: ${codeValues.length}`);

  if (codeValues.length > 0 && !DRY_RUN) {
    let inserted = 0;
    for (const batch of chunk(codeValues, BATCH_SIZE)) {
      const [result] = await conn.query(
        `INSERT IGNORE INTO activation_codes (code, used, used_by, used_at, mode_hint,
          expires_at, created_by, source, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
      inserted += result.affectedRows;
    }
    stats.activation_codes.imported = inserted;
    stats.activation_codes.skipped += codeValues.length - inserted;
  }

  console.log(`  Imported ${stats.activation_codes.imported} activation codes (${stats.activation_codes.skipped} skipped as duplicates or invalid)`);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║    FreeLuma Data Import                      ║');
  console.log('╚══════════════════════════════════════════════╝');
  if (DRY_RUN) console.log('*** DRY RUN MODE — no data will be written ***\n');
  if (ONLY_TABLE) console.log(`*** SINGLE TABLE MODE: ${ONLY_TABLE} ***\n`);

  // Read SQL dump
  console.log(`Reading SQL dump: ${SQL_DUMP_PATH}`);
  const sqlContent = fs.readFileSync(SQL_DUMP_PATH, 'utf8');
  console.log(`  Size: ${(sqlContent.length / 1024 / 1024).toFixed(1)} MB\n`);

  // Connect
  const conn = await getConnection();
  console.log('Connected to freeluma_dev\n');

  const start = Date.now();

  try {
    if (!ONLY_TABLE) {
      // Full import
      await wipeTables(conn);
    }

    // Disable FK checks for bulk import
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query("SET SESSION sql_mode = ''"); // Allow flexible inserts

    // 1. Users (+ user_settings + category mode derivation)
    if (!ONLY_TABLE || ONLY_TABLE === 'users') {
      const validUsers = await importUsers(conn, sqlContent);
      var importedUserIds = new Set(validUsers.map(u => u.id));
    }

    // If we didn't import users (single table mode), load existing user IDs
    if (!importedUserIds) {
      const [existingUsers] = await conn.query('SELECT id FROM users');
      importedUserIds = new Set(existingUsers.map(u => u.id));
    }

    // 2. Posts (+ post_media + prayer_requests)
    let postIdMap;
    if (!ONLY_TABLE || ONLY_TABLE === 'posts') {
      postIdMap = await importPosts(conn, sqlContent, importedUserIds);
    }
    if (!postIdMap) {
      const [existingPosts] = await conn.query('SELECT id FROM posts');
      postIdMap = new Map(existingPosts.map(p => [p.id, p.id]));
    }

    // 3. Post reactions (from liked_posts JSON)
    if (!ONLY_TABLE || ONLY_TABLE === 'post_reactions') {
      await importPostReactions(conn, sqlContent, importedUserIds, postIdMap);
    }

    // 4. Post comments
    let commentIdSet;
    if (!ONLY_TABLE || ONLY_TABLE === 'comments') {
      commentIdSet = await importPostComments(conn, sqlContent, importedUserIds, postIdMap);
    }
    if (!commentIdSet) {
      const [existingComments] = await conn.query('SELECT id FROM post_comments');
      commentIdSet = new Set(existingComments.map(c => c.id));
    }

    // 5. Post comment reactions
    if (!ONLY_TABLE || ONLY_TABLE === 'usercomments') {
      await importPostCommentReactions(conn, sqlContent, importedUserIds, commentIdSet);
    }

    // 6. Follows
    if (!ONLY_TABLE || ONLY_TABLE === 'follows') {
      await importFollows(conn, sqlContent, importedUserIds);
    }

    // 7. Chats -> conversations + messages
    if (!ONLY_TABLE || ONLY_TABLE === 'chats') {
      await importChats(conn, sqlContent, importedUserIds);
    }

    // 8. Daily comments
    let dailyCommentIdMap;
    if (!ONLY_TABLE || ONLY_TABLE === 'dailypostcomments') {
      dailyCommentIdMap = await importDailyComments(conn, sqlContent, importedUserIds);
    }
    if (!dailyCommentIdMap) {
      const [existingComments] = await conn.query('SELECT id FROM daily_comments');
      dailyCommentIdMap = new Map(existingComments.map(c => [c.id, true]));
    }

    // 9. Daily reactions + bookmarks
    if (!ONLY_TABLE || ONLY_TABLE === 'dailypostusers') {
      await importDailyReactionsAndBookmarks(conn, sqlContent, importedUserIds);
    }

    // 10. Daily comment reactions
    if (!ONLY_TABLE || ONLY_TABLE === 'dailypostusercomments') {
      await importDailyCommentReactions(conn, sqlContent, importedUserIds, dailyCommentIdMap);
    }

    // 11. Activation codes from legacy text file
    if (!ONLY_TABLE || ONLY_TABLE === 'activation_codes') {
      await importActivationCodes(conn);
    }

    // Re-enable FK checks
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Seed admin and test user (only on full import)
    if (!ONLY_TABLE) {
      await seedAdminAndTestUser(conn);
    }

    // Re-import seed posts from pre-migration backup, assigned to admin
    if (!ONLY_TABLE) {
      await reimportSeedPosts(conn);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    // Print summary
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║    IMPORT SUMMARY                            ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`  Time: ${elapsed}s`);
    for (const [table, s] of Object.entries(stats)) {
      if (s.imported > 0 || s.skipped > 0) {
        console.log(`  ${table.padEnd(30)} imported: ${String(s.imported).padStart(6)}  skipped: ${String(s.skipped).padStart(6)}`);
      }
    }

    // Verify
    if (!DRY_RUN) {
      console.log('\n=== VERIFICATION ===');
      const tables = [
        'users', 'user_settings', 'posts', 'post_media', 'prayer_requests',
        'post_reactions', 'post_comments', 'post_comment_reactions', 'follows',
        'conversations', 'conversation_participants', 'messages', 'message_media',
        'message_status', 'daily_comments', 'daily_reactions', 'bookmarks',
        'daily_comment_reactions', 'activation_codes'
      ];
      for (const t of tables) {
        try {
          const [rows] = await conn.query(`SELECT COUNT(*) as c FROM \`${t}\``);
          console.log(`  ${t.padEnd(30)} ${String(rows[0].c).padStart(6)} rows`);
        } catch (e) {
          console.log(`  ${t.padEnd(30)} ERROR: ${e.message}`);
        }
      }
    }
  } catch (error) {
    console.error('\n❌ IMPORT ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await conn.end();
  }

  console.log('\nDone!');
}

main();
