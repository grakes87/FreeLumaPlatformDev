#!/usr/bin/env node
/**
 * FreeLuma Incremental Migration Script
 *
 * Takes any version of the old platform's SQL dump and incrementally imports
 * only NEW data — never deleting or modifying existing rows.
 *
 * Usage:
 *   node scripts/migrate-old-data.mjs --sql-file "Old Database/3-2-26.sql" [--dry-run] [--execute]
 *
 * --sql-file <path>  Required. Path to old platform SQL dump.
 * --dry-run          Default mode. Shows mapping report without writing.
 * --execute          Required to actually insert data.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ─── CLI Parsing ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const SQL_FILE = getArgValue('--sql-file');
const EXECUTE = args.includes('--execute');
const DRY_RUN = !EXECUTE; // dry-run is default
const BCRYPT_ROUNDS = 12;
const BATCH_SIZE = 500;

if (!SQL_FILE) {
  console.error('Error: --sql-file is required');
  console.error('Usage: node scripts/migrate-old-data.mjs --sql-file "Old Database/3-2-26.sql" [--dry-run] [--execute]');
  process.exit(1);
}

const sqlFilePath = path.resolve(PROJECT_ROOT, SQL_FILE);
if (!fs.existsSync(sqlFilePath)) {
  console.error(`Error: SQL file not found: ${sqlFilePath}`);
  process.exit(1);
}

// ─── Stats Tracking ─────────────────────────────────────────────────────────

const stats = {};
function initStats(table) {
  stats[table] = { existing: 0, new: 0, skipped: 0 };
}
[
  'users', 'user_settings', 'posts', 'post_media', 'prayer_requests',
  'post_reactions', 'post_comments', 'post_comment_reactions', 'follows',
  'conversations', 'messages', 'message_media', 'message_status',
  'daily_comments', 'daily_reactions', 'bookmarks', 'daily_comment_reactions',
  'listen_logs',
].forEach(initStats);

// ─── SQL Parser (from import-old-data.mjs) ──────────────────────────────────

function parseTable(sqlContent, tableName) {
  const rows = [];
  const insertRegex = new RegExp(
    `INSERT INTO \\\`${tableName}\\\` \\(([^)]+)\\) VALUES\\s*`,
    'g'
  );

  let match;
  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const columns = match[1].split(',').map(c => c.trim().replace(/`/g, ''));
    let pos = match.index + match[0].length;
    const parsedRows = parseValues(sqlContent, pos, columns);
    rows.push(...parsedRows);
  }

  return rows;
}

function parseValues(sql, startPos, columns) {
  const rows = [];
  let pos = startPos;
  const len = sql.length;

  while (pos < len) {
    while (pos < len && /\s/.test(sql[pos])) pos++;
    if (sql[pos] !== '(') break;
    pos++;

    const values = [];
    let valueStart = pos;
    let inString = false;
    let depth = 0;

    while (pos < len) {
      const ch = sql[pos];

      if (inString) {
        if (ch === '\\') { pos += 2; continue; }
        if (ch === "'") {
          if (pos + 1 < len && sql[pos + 1] === "'") { pos += 2; continue; }
          inString = false;
        }
        pos++;
        continue;
      }

      if (ch === "'") { inString = true; pos++; continue; }
      if (ch === '(') { depth++; pos++; continue; }
      if (ch === ')') {
        if (depth > 0) { depth--; pos++; continue; }
        values.push(parseValue(sql.substring(valueStart, pos).trim()));
        pos++;
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

    if (values.length === columns.length) {
      const row = {};
      for (let i = 0; i < columns.length; i++) {
        row[columns[i]] = values[i];
      }
      rows.push(row);
    }

    while (pos < len && /[\s,]/.test(sql[pos])) pos++;
    if (sql[pos] === ';') break;
  }

  return rows;
}

function parseValue(raw) {
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

// ─── HTML Stripping ─────────────────────────────────────────────────────────

function stripHtml(html) {
  if (!html) return html;
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
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

// ─── Database Connection ────────────────────────────────────────────────────

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

// ─── Utilities ──────────────────────────────────────────────────────────────

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function log(msg) {
  console.log(msg);
}

// ─── 1. Incremental Users + User Settings ───────────────────────────────────

async function migrateUsers(conn, sqlContent) {
  log('  [1/11] Users + user_settings...');

  const oldUsers = parseTable(sqlContent, 'users');

  // Parse category_user_relations for mode derivation
  const catRelations = parseTable(sqlContent, 'category_user_relations');
  const userCategories = new Map();
  for (const rel of catRelations) {
    if (!userCategories.has(rel.user_id)) userCategories.set(rel.user_id, new Set());
    userCategories.get(rel.user_id).add(rel.category_id);
  }

  // Query existing user IDs, emails, and usernames from DB
  const [existingUsers] = await conn.query('SELECT id, email, LOWER(username) as username FROM users');
  const existingIds = new Set(existingUsers.map(u => u.id));
  const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));
  const existingUsernames = new Set(existingUsers.map(u => u.username));

  // Filter valid users
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

  // Compute delta: skip users whose ID already exists
  const newUsers = [];
  for (const u of validUsers) {
    if (existingIds.has(u.id)) {
      stats.users.existing++;
      continue;
    }
    // Check email/username uniqueness against DB
    if (existingEmails.has(u.email.toLowerCase())) {
      stats.users.skipped++;
      continue;
    }
    newUsers.push(u);
  }

  // Deduplicate usernames among new users (case-insensitive)
  // Also check against existing DB usernames
  const usernamesSeen = new Set(existingUsernames);
  let dupFixed = 0;
  for (const u of newUsers) {
    // Reserve 'freeluma' for admin
    if (u.username.toLowerCase() === 'freeluma') {
      u.username = `freeluma_old${u.id}`;
    }
    const lower = u.username.toLowerCase();
    if (usernamesSeen.has(lower)) {
      u.username = `${u.username}${u.id}`;
      if (u.username.length > 30) u.username = u.username.substring(0, 30);
      dupFixed++;
    }
    usernamesSeen.add(u.username.toLowerCase());
  }

  stats.users.new = newUsers.length;

  if (newUsers.length === 0) {
    log(`    Parsed ${oldUsers.length} from dump, ${stats.users.existing} existing, 0 new`);
    stats.user_settings.existing = stats.users.existing;
    return new Set(existingIds);
  }

  log(`    Parsed ${oldUsers.length} from dump, ${stats.users.existing} existing, ${newUsers.length} new, ${stats.users.skipped} skipped (${dupFixed} username dedup)`);

  if (!DRY_RUN) {
    const userBatches = chunk(newUsers, BATCH_SIZE);
    for (const batch of userBatches) {
      const userValues = [];
      const settingsValues = [];

      for (const u of batch) {
        // Password transformation
        let passwordHash = u.password;
        if (passwordHash) {
          if (passwordHash.startsWith('$2y$')) {
            passwordHash = passwordHash.replace('$2y$', '$2b$');
          } else if (!passwordHash.startsWith('$2b$') && !passwordHash.startsWith('$2a$')) {
            passwordHash = await bcrypt.hash(passwordHash, BCRYPT_ROUNDS);
          }
        }

        const status = u.id <= 85 ? 'deactivated' : 'active';

        const cats = userCategories.get(u.id);
        let mode = 'bible';
        if (cats) {
          if (cats.has(2) && !cats.has(1)) mode = 'positivity';
        }

        let preferredTranslation = u.bible_setting || 'KJV';
        if (preferredTranslation === 'FLP') preferredTranslation = 'KJV';
        if (preferredTranslation.length > 10) preferredTranslation = preferredTranslation.substring(0, 10);

        let dob = u.dob;
        if (dob === '0000-00-00' || dob === '0000-00-00 00:00:00') dob = null;

        let displayName = ((u.first_name || '') + ' ' + (u.last_name || '')).trim();
        if (!displayName) displayName = u.username || 'User';
        if (displayName.length > 100) displayName = displayName.substring(0, 100);

        const profilePrivacy = u.account_visibility === 'PRIVATE' ? 'private' : 'public';

        const locationParts = [u.city, u.state, u.country].filter(Boolean).filter(s => s.trim());
        let location = locationParts.join(', ') || null;
        if (location && location.length > 200) location = location.substring(0, 200);

        let avatarUrl = u.profile_picture;
        if (avatarUrl === 'default.jpg') avatarUrl = null;

        const username = u.username.substring(0, 30);

        let phone = u.phone || null;
        if (phone && phone.length > 20) phone = phone.substring(0, 20);
        if (phone === '') phone = null;

        userValues.push([
          u.id, u.email, passwordHash, null, null, displayName, username,
          avatarUrl, '#6366F1', null, null, null, null, profilePrivacy,
          location, null, phone, dob, mode, 'America/New_York', preferredTranslation,
          'en', 1, null, 1, 0, 0, 'user', 1, status,
          status === 'deactivated' ? u.createdAt : null, null, null, 0, null, null,
          u.createdAt, u.updatedAt,
        ]);

        let dailyReminderTime = '08:00';
        if (u.daily_post_notification_time) {
          const timeParts = String(u.daily_post_notification_time).split(':');
          if (timeParts.length >= 2) {
            dailyReminderTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
          }
        }

        settingsValues.push([
          u.id, 'system', 1, 1, dailyReminderTime, null, null, 'mutual',
          1, 1, 1, 1, null, u.createdAt, u.updatedAt,
        ]);
      }

      if (userValues.length > 0) {
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
    }
  }

  stats.user_settings.existing = stats.users.existing;
  stats.user_settings.new = stats.users.new;

  // Return all valid user IDs (existing + new)
  const allUserIds = new Set(existingIds);
  for (const u of newUsers) allUserIds.add(u.id);
  return allUserIds;
}

// ─── 2. Incremental Posts + Post Media + Prayer Requests ────────────────────

async function migratePosts(conn, sqlContent, validUserIds) {
  log('  [2/11] Posts + post_media + prayer_requests...');

  const oldPosts = parseTable(sqlContent, 'posts');

  // Query existing post IDs
  const [existingPosts] = await conn.query('SELECT id FROM posts');
  const existingPostIds = new Set(existingPosts.map(p => p.id));

  const postValues = [];
  const mediaValues = [];
  const prayerValues = [];
  const newPostIds = new Set();

  for (const p of oldPosts) {
    if (p.is_deleted === 1) { stats.posts.skipped++; continue; }
    if (!validUserIds.has(p.user_id)) { stats.posts.skipped++; continue; }

    if (existingPostIds.has(p.id)) {
      stats.posts.existing++;
      continue;
    }

    let postType = 'text';
    if (p.post_type === 'PRAYER_WALL') postType = 'prayer_request';

    let mode = 'bible';
    if (p.category_id === 2) mode = 'positivity';

    const body = stripHtml(p.text_content) || '';

    postValues.push([
      p.id, p.user_id, body, postType, 'public', mode,
      p.is_updated ? 1 : 0, 0, 0, 0, null, p.createdAt, p.updatedAt,
    ]);
    newPostIds.add(p.id);

    // Parse media JSON
    if (p.media) {
      try {
        const mediaArr = JSON.parse(p.media);
        if (Array.isArray(mediaArr)) {
          let sortOrder = 0;
          for (const m of mediaArr) {
            const mediaUrl = typeof m === 'string' ? m : (m.file_name || m.filename || m.url || null);
            if (!mediaUrl) continue;
            let mediaType = 'image';
            if (typeof m === 'object' && m.file_type) {
              mediaType = m.file_type === 'video' ? 'video' : 'image';
            } else {
              const ext = mediaUrl.toLowerCase().split('.').pop();
              if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) mediaType = 'video';
            }
            mediaValues.push([
              p.id, mediaUrl, mediaType, null, null, null, null, sortOrder++,
              p.createdAt, p.updatedAt,
            ]);
          }
        }
      } catch (e) { /* skip invalid JSON */ }
    }

    if (postType === 'prayer_request') {
      prayerValues.push([
        p.id, 'public', 'active', null, null, 0, p.createdAt, p.updatedAt,
      ]);
    }
  }

  stats.posts.new = postValues.length;
  stats.post_media.new = mediaValues.length;
  stats.prayer_requests.new = prayerValues.length;

  log(`    Parsed ${oldPosts.length} from dump, ${stats.posts.existing} existing, ${postValues.length} new, ${stats.posts.skipped} skipped`);

  if (!DRY_RUN && postValues.length > 0) {
    for (const batch of chunk(postValues, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO posts (id, user_id, body, post_type, visibility, mode, edited, is_anonymous,
          flagged, hidden, deleted_at, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
    if (mediaValues.length > 0) {
      for (const batch of chunk(mediaValues, BATCH_SIZE)) {
        await conn.query(
          `INSERT IGNORE INTO post_media (post_id, url, media_type, thumbnail_url, width, height,
            duration, sort_order, created_at, updated_at)
          VALUES ?`,
          [batch]
        );
      }
    }
    if (prayerValues.length > 0) {
      for (const batch of chunk(prayerValues, BATCH_SIZE)) {
        await conn.query(
          `INSERT IGNORE INTO prayer_requests (post_id, privacy, status, answered_at,
            answered_testimony, pray_count, created_at, updated_at)
          VALUES ?`,
          [batch]
        );
      }
    }
  }

  // Return all valid post IDs (existing + new)
  const allPostIds = new Set(existingPostIds);
  for (const id of newPostIds) allPostIds.add(id);
  return allPostIds;
}

// ─── 3. Incremental Post Reactions (liked_posts JSON) ───────────────────────

async function migratePostReactions(conn, sqlContent, validUserIds, validPostIds) {
  log('  [3/11] Post reactions (liked_posts JSON)...');

  const oldUsers = parseTable(sqlContent, 'users');

  // Query existing (user_id, post_id) pairs
  const [existingReactions] = await conn.query(
    'SELECT user_id, post_id FROM post_reactions'
  );
  const existingPairs = new Set(existingReactions.map(r => `${r.user_id}-${r.post_id}`));

  const values = [];
  const seenInDump = new Set();

  for (const u of oldUsers) {
    if (!validUserIds.has(u.id)) continue;
    if (!u.liked_posts || u.liked_posts === '[]') continue;
    try {
      const postIds = JSON.parse(u.liked_posts);
      if (!Array.isArray(postIds)) continue;
      for (const pid of postIds) {
        const postId = Number(pid);
        if (!validPostIds.has(postId)) continue;
        const key = `${u.id}-${postId}`;
        if (existingPairs.has(key)) { stats.post_reactions.existing++; continue; }
        if (seenInDump.has(key)) continue;
        seenInDump.add(key);
        values.push([u.id, postId, 'love', u.updatedAt, u.updatedAt]);
      }
    } catch (e) { /* skip */ }
  }

  stats.post_reactions.new = values.length;
  log(`    ${stats.post_reactions.existing} existing, ${values.length} new`);

  if (!DRY_RUN && values.length > 0) {
    for (const batch of chunk(values, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO post_reactions (user_id, post_id, reaction_type, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
}

// ─── 4. Incremental Post Comments ───────────────────────────────────────────

async function migratePostComments(conn, sqlContent, validUserIds, validPostIds) {
  log('  [4/11] Post comments...');

  const oldComments = parseTable(sqlContent, 'comments');

  // Query existing comment IDs
  const [existingComments] = await conn.query('SELECT id FROM post_comments');
  const existingIds = new Set(existingComments.map(c => c.id));

  const rootValues = [];
  const childValues = [];
  const newCommentIds = new Set();
  // Track all comment IDs in the dump for parent validation
  const dumpCommentIds = new Set(oldComments.filter(c => c.is_deleted !== 1).map(c => c.id));

  for (const c of oldComments) {
    if (c.is_deleted === 1) { stats.post_comments.skipped++; continue; }
    if (!validUserIds.has(c.user_id)) { stats.post_comments.skipped++; continue; }
    if (!validPostIds.has(c.post_id)) { stats.post_comments.skipped++; continue; }

    if (existingIds.has(c.id)) {
      stats.post_comments.existing++;
      continue;
    }

    const parentId = c.parent_id === 0 ? null : c.parent_id;
    const body = stripHtml(c.text_content) || '';

    const row = [c.id, c.user_id, c.post_id, parentId, body, 0, 0, 0, c.createdAt, c.updatedAt];

    if (parentId === null) {
      rootValues.push(row);
    } else {
      childValues.push(row);
    }
    newCommentIds.add(c.id);
  }

  // Filter children whose parent exists (in DB or in new roots)
  const allCommentIds = new Set([...existingIds, ...newCommentIds]);
  const validChildren = childValues.filter(v => allCommentIds.has(v[3]));
  const orphanChildren = childValues.length - validChildren.length;
  stats.post_comments.skipped += orphanChildren;

  stats.post_comments.new = rootValues.length + validChildren.length;
  log(`    Parsed ${oldComments.length} from dump, ${stats.post_comments.existing} existing, ${stats.post_comments.new} new (${rootValues.length} roots + ${validChildren.length} replies), ${stats.post_comments.skipped} skipped`);

  if (!DRY_RUN) {
    // First pass: roots
    for (const batch of chunk(rootValues, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO post_comments (id, user_id, post_id, parent_id, body, edited, flagged, hidden,
          created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
    // Second pass: children
    for (const batch of chunk(validChildren, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO post_comments (id, user_id, post_id, parent_id, body, edited, flagged, hidden,
          created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }

  // Return all valid comment IDs
  const allIds = new Set(existingIds);
  for (const id of newCommentIds) allIds.add(id);
  return allIds;
}

// ─── 5. Incremental Post Comment Reactions ──────────────────────────────────

async function migratePostCommentReactions(conn, sqlContent, validUserIds, validCommentIds) {
  log('  [5/11] Post comment reactions...');

  const oldReactions = parseTable(sqlContent, 'usercomments');

  // Query existing pairs
  const [existingReactions] = await conn.query(
    'SELECT user_id, comment_id FROM post_comment_reactions'
  );
  const existingPairs = new Set(existingReactions.map(r => `${r.user_id}-${r.comment_id}`));

  const values = [];
  const seenInDump = new Set();

  for (const r of oldReactions) {
    if (r.is_liked !== 1) { stats.post_comment_reactions.skipped++; continue; }
    if (!validUserIds.has(r.user_id)) { stats.post_comment_reactions.skipped++; continue; }
    if (!validCommentIds.has(r.comment_id)) { stats.post_comment_reactions.skipped++; continue; }

    const key = `${r.user_id}-${r.comment_id}`;
    if (existingPairs.has(key)) { stats.post_comment_reactions.existing++; continue; }
    if (seenInDump.has(key)) continue;
    seenInDump.add(key);

    values.push([r.user_id, r.comment_id, 'love', r.createdAt, r.updatedAt]);
  }

  stats.post_comment_reactions.new = values.length;
  log(`    ${stats.post_comment_reactions.existing} existing, ${values.length} new, ${stats.post_comment_reactions.skipped} skipped`);

  if (!DRY_RUN && values.length > 0) {
    for (const batch of chunk(values, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO post_comment_reactions (user_id, comment_id, reaction_type, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
}

// ─── 6. Incremental Follows ─────────────────────────────────────────────────

async function migrateFollows(conn, sqlContent, validUserIds) {
  log('  [6/11] Follows...');

  const oldFollows = parseTable(sqlContent, 'follows');

  // Query existing (follower_id, following_id) pairs
  const [existingFollows] = await conn.query(
    'SELECT follower_id, following_id FROM follows'
  );
  const existingPairs = new Set(existingFollows.map(f => `${f.follower_id}-${f.following_id}`));

  const values = [];
  const seenInDump = new Set();

  for (const f of oldFollows) {
    if (!validUserIds.has(f.follower_id) || !validUserIds.has(f.following_id)) {
      stats.follows.skipped++;
      continue;
    }
    if (f.follower_id === f.following_id) { stats.follows.skipped++; continue; }

    const key = `${f.follower_id}-${f.following_id}`;
    if (existingPairs.has(key)) { stats.follows.existing++; continue; }
    if (seenInDump.has(key)) { stats.follows.skipped++; continue; }
    seenInDump.add(key);

    const status = f.status === 1 ? 'active' : 'pending';
    values.push([f.id, f.follower_id, f.following_id, status, f.createdAt, f.updatedAt]);
  }

  stats.follows.new = values.length;
  log(`    Parsed ${oldFollows.length} from dump, ${stats.follows.existing} existing, ${values.length} new, ${stats.follows.skipped} skipped`);

  if (!DRY_RUN && values.length > 0) {
    for (const batch of chunk(values, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO follows (id, follower_id, following_id, status, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
}

// ─── 7. Incremental Chats → Conversations + Messages ───────────────────────

async function migrateChats(conn, sqlContent, validUserIds) {
  log('  [7/11] Chats → conversations + messages...');

  const oldChats = parseTable(sqlContent, 'chats');

  // Group chats by conversation pair (min_id, max_id)
  const convMap = new Map(); // "minId-maxId" -> sorted messages

  for (const c of oldChats) {
    if (!validUserIds.has(c.sender_id) || !validUserIds.has(c.receiver_id)) continue;
    if (c.sender_id === c.receiver_id) continue;
    const minId = Math.min(c.sender_id, c.receiver_id);
    const maxId = Math.max(c.sender_id, c.receiver_id);
    const key = `${minId}-${maxId}`;
    if (!convMap.has(key)) convMap.set(key, []);
    convMap.get(key).push(c);
  }

  for (const [, msgs] of convMap) {
    msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  // Query existing direct conversation pairs + their max message timestamp
  const [existingConvs] = await conn.query(`
    SELECT c.id as conv_id,
      LEAST(cp1.user_id, cp2.user_id) as min_user,
      GREATEST(cp1.user_id, cp2.user_id) as max_user,
      (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) as max_msg_time
    FROM conversations c
    JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
    JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id > cp1.user_id
    WHERE c.type = 'direct'
  `);

  const existingConvMap = new Map(); // "minId-maxId" -> { conv_id, max_msg_time }
  for (const row of existingConvs) {
    const key = `${row.min_user}-${row.max_user}`;
    existingConvMap.set(key, { convId: row.conv_id, maxMsgTime: row.max_msg_time });
  }

  let newConvCount = 0;
  let newMsgCount = 0;
  let existingConvCount = 0;
  let newMsgForExistingConvCount = 0;

  // Get max conversation ID for new ones
  const [maxConvRow] = await conn.query('SELECT MAX(id) as m FROM conversations');
  let nextConvId = (maxConvRow[0].m || 0) + 1;

  for (const [key, msgs] of convMap) {
    const [minId, maxId] = key.split('-').map(Number);
    const existing = existingConvMap.get(key);

    if (existing) {
      // Existing conversation — only insert messages newer than max timestamp
      existingConvCount++;
      const cutoff = existing.maxMsgTime ? new Date(existing.maxMsgTime) : new Date(0);

      const newMsgs = msgs.filter(m => new Date(m.createdAt) > cutoff);
      if (newMsgs.length === 0) continue;

      if (!DRY_RUN) {
        let lastMessageId = null;
        for (const m of newMsgs) {
          let msgType = 'text';
          if (m.message_type === 'IMAGE' || m.message_type === 'VIDEO') msgType = 'media';
          else if (m.message_type === 'AUDIO') msgType = 'voice';
          const content = msgType === 'text' ? (m.message || '') : null;

          const [result] = await conn.query(
            `INSERT INTO messages (conversation_id, sender_id, type, content, reply_to_id, shared_post_id,
              shared_video_id, is_unsent, flagged, created_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)`,
            [existing.convId, m.sender_id, msgType, content, m.createdAt, m.updatedAt]
          );
          const messageId = result.insertId;
          lastMessageId = messageId;

          if (m.media && (msgType === 'media' || msgType === 'voice')) {
            let mediaType = 'image';
            if (m.message_type === 'VIDEO') mediaType = 'video';
            else if (m.message_type === 'AUDIO') mediaType = 'voice';
            await conn.query(
              `INSERT INTO message_media (message_id, media_url, media_type, duration, sort_order, created_at, updated_at)
              VALUES (?, ?, ?, NULL, 0, ?, ?)`,
              [messageId, m.media, mediaType, m.createdAt, m.updatedAt]
            );
            stats.message_media.new++;
          }

          if (m.is_seen === 1) {
            await conn.query(
              `INSERT INTO message_status (message_id, user_id, status, status_at)
              VALUES (?, ?, 'read', ?)`,
              [messageId, m.receiver_id, m.updatedAt]
            );
            stats.message_status.new++;
          }
        }

        // Update conversation last_message_at and last_message_id
        if (lastMessageId) {
          const lastMsg = newMsgs[newMsgs.length - 1];
          await conn.query(
            'UPDATE conversations SET last_message_at = ?, last_message_id = ? WHERE id = ?',
            [lastMsg.createdAt, lastMessageId, existing.convId]
          );
        }
      }

      newMsgForExistingConvCount += newMsgs.length;
      stats.messages.new += newMsgs.length;
    } else {
      // New conversation
      newConvCount++;
      const firstMsg = msgs[0];
      const lastMsg = msgs[msgs.length - 1];

      if (!DRY_RUN) {
        const convId = nextConvId++;

        await conn.query(
          `INSERT INTO conversations (id, type, name, avatar_url, creator_id, last_message_at, created_at, updated_at)
          VALUES (?, 'direct', NULL, NULL, ?, ?, ?, ?)`,
          [convId, firstMsg.sender_id, lastMsg.createdAt, firstMsg.createdAt, lastMsg.updatedAt]
        );

        // Determine last_read_at per participant
        let lastReadMinId = null;
        let lastReadMaxId = null;
        for (const m of msgs) {
          if (m.is_seen === 1) {
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

        let lastMessageId = null;
        for (const m of msgs) {
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

          if (m.media && (msgType === 'media' || msgType === 'voice')) {
            let mediaType = 'image';
            if (m.message_type === 'VIDEO') mediaType = 'video';
            else if (m.message_type === 'AUDIO') mediaType = 'voice';
            await conn.query(
              `INSERT INTO message_media (message_id, media_url, media_type, duration, sort_order, created_at, updated_at)
              VALUES (?, ?, ?, NULL, 0, ?, ?)`,
              [messageId, m.media, mediaType, m.createdAt, m.updatedAt]
            );
            stats.message_media.new++;
          }

          if (m.is_seen === 1) {
            await conn.query(
              `INSERT INTO message_status (message_id, user_id, status, status_at)
              VALUES (?, ?, 'read', ?)`,
              [messageId, m.receiver_id, m.updatedAt]
            );
            stats.message_status.new++;
          }
        }

        if (lastMessageId) {
          await conn.query(
            'UPDATE conversations SET last_message_id = ? WHERE id = ?',
            [lastMessageId, convId]
          );
        }
      }

      stats.messages.new += msgs.length;
    }
  }

  stats.conversations.existing = existingConvCount;
  stats.conversations.new = newConvCount;

  log(`    Parsed ${oldChats.length} chat msgs → ${convMap.size} pairs. ${existingConvCount} existing convs (${newMsgForExistingConvCount} new msgs), ${newConvCount} new convs`);
}

// ─── 8. Incremental Daily Comments ──────────────────────────────────────────

async function migrateDailyComments(conn, sqlContent, validUserIds) {
  log('  [8/11] Daily comments...');

  // Build dailypost ID -> date mapping from old dump
  const oldDailyPosts = parseTable(sqlContent, 'dailyposts');
  const dailyPostDateMap = new Map();
  for (const dp of oldDailyPosts) {
    dailyPostDateMap.set(dp.id, dp.daily_post_name);
  }

  // Build date -> new daily_content_id mapping (English entries only)
  const [dcRows] = await conn.query(
    "SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') as post_date FROM daily_content WHERE language = 'en'"
  );
  const dateToContentId = new Map();
  for (const row of dcRows) {
    dateToContentId.set(row.post_date, row.id);
  }

  const oldComments = parseTable(sqlContent, 'dailypostcomments');

  // Query existing daily comment IDs
  const [existingComments] = await conn.query('SELECT id FROM daily_comments');
  const existingIds = new Set(existingComments.map(c => c.id));

  const rootValues = [];
  const childValues = [];
  const newCommentIds = new Set();

  for (const c of oldComments) {
    if (c.is_deleted === 1) { stats.daily_comments.skipped++; continue; }
    if (!validUserIds.has(c.user_id)) { stats.daily_comments.skipped++; continue; }

    if (existingIds.has(c.id)) { stats.daily_comments.existing++; continue; }

    const dateStr = dailyPostDateMap.get(c.daily_post_id);
    if (!dateStr) { stats.daily_comments.skipped++; continue; }
    const contentId = dateToContentId.get(dateStr);
    if (!contentId) { stats.daily_comments.skipped++; continue; }

    const parentId = c.parent_id === 0 ? null : c.parent_id;
    const body = stripHtml(c.text_content) || '';

    const row = [c.id, c.user_id, contentId, parentId, body, 0, c.createdAt, c.updatedAt];

    if (parentId === null) {
      rootValues.push(row);
    } else {
      childValues.push(row);
    }
    newCommentIds.add(c.id);
  }

  // Filter children whose parent exists
  const allIds = new Set([...existingIds, ...newCommentIds]);
  const validChildren = childValues.filter(v => allIds.has(v[3]));
  stats.daily_comments.skipped += childValues.length - validChildren.length;

  stats.daily_comments.new = rootValues.length + validChildren.length;
  log(`    Parsed ${oldComments.length} from dump, ${stats.daily_comments.existing} existing, ${stats.daily_comments.new} new, ${stats.daily_comments.skipped} skipped`);

  if (!DRY_RUN) {
    for (const batch of chunk(rootValues, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO daily_comments (id, user_id, daily_content_id, parent_id, body, edited,
          created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
    for (const batch of chunk(validChildren, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO daily_comments (id, user_id, daily_content_id, parent_id, body, edited,
          created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }

  // Return all valid comment IDs
  for (const id of newCommentIds) allIds.add(id);
  return allIds;
}

// ─── 9. Incremental Daily Reactions + Bookmarks ─────────────────────────────

async function migrateDailyReactionsAndBookmarks(conn, sqlContent, validUserIds) {
  log('  [9/11] Daily reactions + bookmarks...');

  // Build dailypost date map
  const oldDailyPosts = parseTable(sqlContent, 'dailyposts');
  const dailyPostDateMap = new Map();
  for (const dp of oldDailyPosts) {
    dailyPostDateMap.set(dp.id, dp.daily_post_name);
  }

  // Date -> daily_content_id
  const [dcRows] = await conn.query(
    "SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') as post_date FROM daily_content WHERE language = 'en'"
  );
  const dateToContentId = new Map();
  for (const row of dcRows) {
    dateToContentId.set(row.post_date, row.id);
  }

  const oldDailyUsers = parseTable(sqlContent, 'dailypostusers');

  // Query existing pairs
  const [existingReactions] = await conn.query(
    'SELECT user_id, daily_content_id FROM daily_reactions'
  );
  const existingReactionPairs = new Set(existingReactions.map(r => `${r.user_id}-${r.daily_content_id}`));

  const [existingBookmarks] = await conn.query(
    'SELECT user_id, daily_content_id FROM bookmarks WHERE daily_content_id IS NOT NULL'
  );
  const existingBookmarkPairs = new Set(existingBookmarks.map(b => `${b.user_id}-${b.daily_content_id}`));

  const reactionValues = [];
  const bookmarkValues = [];
  const seenReactions = new Set();
  const seenBookmarks = new Set();

  for (const du of oldDailyUsers) {
    if (!validUserIds.has(du.user_id)) continue;

    const dateStr = dailyPostDateMap.get(du.daily_post_id);
    if (!dateStr) continue;
    const contentId = dateToContentId.get(dateStr);
    if (!contentId) continue;

    if (du.is_liked === 1) {
      const key = `${du.user_id}-${contentId}`;
      if (existingReactionPairs.has(key)) { stats.daily_reactions.existing++; }
      else if (!seenReactions.has(key)) {
        seenReactions.add(key);
        reactionValues.push([du.user_id, contentId, 'love', du.createdAt, du.updatedAt]);
      }
    }

    if (du.is_bookmarked === 1) {
      const key = `${du.user_id}-${contentId}`;
      if (existingBookmarkPairs.has(key)) { stats.bookmarks.existing++; }
      else if (!seenBookmarks.has(key)) {
        seenBookmarks.add(key);
        bookmarkValues.push([du.user_id, null, contentId, du.createdAt, du.updatedAt]);
      }
    }
  }

  stats.daily_reactions.new = reactionValues.length;
  stats.bookmarks.new = bookmarkValues.length;

  log(`    Reactions: ${stats.daily_reactions.existing} existing, ${reactionValues.length} new | Bookmarks: ${stats.bookmarks.existing} existing, ${bookmarkValues.length} new`);

  if (!DRY_RUN) {
    if (reactionValues.length > 0) {
      for (const batch of chunk(reactionValues, BATCH_SIZE)) {
        await conn.query(
          `INSERT IGNORE INTO daily_reactions (user_id, daily_content_id, reaction_type, created_at, updated_at)
          VALUES ?`,
          [batch]
        );
      }
    }
    if (bookmarkValues.length > 0) {
      for (const batch of chunk(bookmarkValues, BATCH_SIZE)) {
        await conn.query(
          `INSERT IGNORE INTO bookmarks (user_id, post_id, daily_content_id, created_at, updated_at)
          VALUES ?`,
          [batch]
        );
      }
    }
  }
}

// ─── 10. Incremental Daily Comment Reactions ────────────────────────────────

async function migrateDailyCommentReactions(conn, sqlContent, validUserIds, validCommentIds) {
  log('  [10/11] Daily comment reactions...');

  const oldReactions = parseTable(sqlContent, 'dailypostusercomments');

  // Query existing pairs
  const [existingReactions] = await conn.query(
    'SELECT comment_id, user_id FROM daily_comment_reactions'
  );
  const existingPairs = new Set(existingReactions.map(r => `${r.comment_id}-${r.user_id}`));

  const values = [];
  const seenInDump = new Set();

  for (const r of oldReactions) {
    if (r.is_liked !== 1) { stats.daily_comment_reactions.skipped++; continue; }
    if (!validUserIds.has(r.user_id)) { stats.daily_comment_reactions.skipped++; continue; }
    if (!validCommentIds.has(r.comment_id)) { stats.daily_comment_reactions.skipped++; continue; }

    const key = `${r.comment_id}-${r.user_id}`;
    if (existingPairs.has(key)) { stats.daily_comment_reactions.existing++; continue; }
    if (seenInDump.has(key)) continue;
    seenInDump.add(key);

    values.push([r.comment_id, r.user_id, r.createdAt, r.updatedAt]);
  }

  stats.daily_comment_reactions.new = values.length;
  log(`    ${stats.daily_comment_reactions.existing} existing, ${values.length} new, ${stats.daily_comment_reactions.skipped} skipped`);

  if (!DRY_RUN && values.length > 0) {
    for (const batch of chunk(values, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO daily_comment_reactions (comment_id, user_id, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
}

// ─── 11. Incremental Listen Logs (dailychapters → listen_logs) ──────────────

async function migrateListenLogs(conn, sqlContent, validUserIds) {
  log('  [11/11] Listen logs (dailychapters)...');

  const oldChapters = parseTable(sqlContent, 'dailychapters');

  if (oldChapters.length === 0) {
    log('    No dailychapters table found in dump, skipping');
    return;
  }

  // Build date -> daily_content_id mapping (English entries only)
  const [dcRows] = await conn.query(
    "SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') as post_date FROM daily_content WHERE language = 'en'"
  );
  const dateToContentId = new Map();
  for (const row of dcRows) {
    dateToContentId.set(row.post_date, row.id);
  }

  // Query existing (user_id, daily_content_id) pairs
  const [existingLogs] = await conn.query(
    'SELECT user_id, daily_content_id FROM listen_logs'
  );
  const existingPairs = new Set(existingLogs.map(l => `${l.user_id}-${l.daily_content_id}`));

  // Dedup within dump: multiple rows per (user_id, date) → take highest listen_time, prefer is_completed=1
  const dedupMap = new Map(); // "user_id-date" -> best row
  for (const ch of oldChapters) {
    if (!validUserIds.has(ch.user_id)) continue;
    if (!ch.chapter_name) continue;

    // chapter_name is a date string like "2025-03-13"
    const dateStr = ch.chapter_name;
    const key = `${ch.user_id}-${dateStr}`;

    const listenTime = Number(ch.listen_time) || 0;
    const isCompleted = ch.is_completed === 1 || ch.is_completed === '1';

    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, { ...ch, _listenTime: listenTime, _isCompleted: isCompleted, _dateStr: dateStr });
    } else {
      // Prefer completed, then highest listen time
      if (isCompleted && !existing._isCompleted) {
        dedupMap.set(key, { ...ch, _listenTime: listenTime, _isCompleted: isCompleted, _dateStr: dateStr });
      } else if (isCompleted === existing._isCompleted && listenTime > existing._listenTime) {
        dedupMap.set(key, { ...ch, _listenTime: listenTime, _isCompleted: isCompleted, _dateStr: dateStr });
      }
    }
  }

  const values = [];
  let skippedNoContent = 0;

  for (const [, ch] of dedupMap) {
    const contentId = dateToContentId.get(ch._dateStr);
    if (!contentId) { skippedNoContent++; continue; }

    const pairKey = `${ch.user_id}-${contentId}`;
    if (existingPairs.has(pairKey)) { stats.listen_logs.existing++; continue; }

    values.push([
      ch.user_id,
      contentId,
      ch._listenTime,
      ch._isCompleted ? 1 : 0,
      ch.createdAt || new Date().toISOString().slice(0, 19).replace('T', ' '),
      ch.updatedAt || new Date().toISOString().slice(0, 19).replace('T', ' '),
    ]);
  }

  stats.listen_logs.new = values.length;
  stats.listen_logs.skipped = skippedNoContent + (oldChapters.length - dedupMap.size - (oldChapters.length - [...dedupMap.values()].length));
  // Recalculate skipped more simply
  const totalInDump = oldChapters.length;
  const dedupCount = dedupMap.size;
  const dedupSkipped = totalInDump - dedupCount; // rows lost to dedup
  stats.listen_logs.skipped = skippedNoContent + dedupSkipped;

  log(`    Parsed ${totalInDump} from dump (${dedupCount} after dedup), ${stats.listen_logs.existing} existing, ${values.length} new, ${stats.listen_logs.skipped} skipped`);

  if (!DRY_RUN && values.length > 0) {
    for (const batch of chunk(values, BATCH_SIZE)) {
      await conn.query(
        `INSERT IGNORE INTO listen_logs (user_id, daily_content_id, listen_seconds, completed, created_at, updated_at)
        VALUES ?`,
        [batch]
      );
    }
  }
}

// ─── Report Printer ─────────────────────────────────────────────────────────

function printReport(sqlFilePath, elapsed) {
  const fileSize = fs.statSync(sqlFilePath).size;
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1);

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    FreeLuma Incremental Migration Report         ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Source: ${path.relative(PROJECT_ROOT, sqlFilePath)} (${fileSizeMB} MB)`);
  console.log(`  Mode:   ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`  Time:   ${elapsed}s`);
  console.log('');
  console.log('  Table                         Existing       New   Skipped');
  console.log('  ─────────────────────────────────────────────────────────────');

  let totalExisting = 0;
  let totalNew = 0;
  let totalSkipped = 0;

  for (const [table, s] of Object.entries(stats)) {
    if (s.existing > 0 || s.new > 0 || s.skipped > 0) {
      console.log(
        `  ${table.padEnd(30)} ${String(s.existing).padStart(8)}  ${String(s.new).padStart(8)}  ${String(s.skipped).padStart(8)}`
      );
      totalExisting += s.existing;
      totalNew += s.new;
      totalSkipped += s.skipped;
    }
  }

  console.log('  ─────────────────────────────────────────────────────────────');
  console.log(
    `  ${'TOTAL'.padEnd(30)} ${String(totalExisting).padStart(8)}  ${String(totalNew).padStart(8)}  ${String(totalSkipped).padStart(8)}`
  );
  console.log('');

  if (DRY_RUN && totalNew > 0) {
    console.log('  Run with --execute to apply these changes.');
    console.log('');
  }
}

// ─── Main Orchestrator ──────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    FreeLuma Incremental Migration                ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Source: ${sqlFilePath}`);
  console.log(`  Mode:   ${DRY_RUN ? 'DRY RUN (add --execute to write)' : 'EXECUTE'}`);
  console.log('');

  // Read SQL dump
  log('  Reading SQL dump...');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  log(`  Size: ${(sqlContent.length / 1024 / 1024).toFixed(1)} MB`);

  // Connect
  const conn = await getConnection();
  log('  Connected to freeluma_dev\n');

  const start = Date.now();

  try {
    // Disable FK checks for bulk import
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query("SET SESSION sql_mode = ''");

    // 1. Users + user_settings
    const validUserIds = await migrateUsers(conn, sqlContent);

    // 2. Posts + post_media + prayer_requests
    const validPostIds = await migratePosts(conn, sqlContent, validUserIds);

    // 3. Post reactions
    await migratePostReactions(conn, sqlContent, validUserIds, validPostIds);

    // 4. Post comments
    const validCommentIds = await migratePostComments(conn, sqlContent, validUserIds, validPostIds);

    // 5. Post comment reactions
    await migratePostCommentReactions(conn, sqlContent, validUserIds, validCommentIds);

    // 6. Follows
    await migrateFollows(conn, sqlContent, validUserIds);

    // 7. Chats -> conversations + messages
    await migrateChats(conn, sqlContent, validUserIds);

    // 8. Daily comments
    const dailyCommentIds = await migrateDailyComments(conn, sqlContent, validUserIds);

    // 9. Daily reactions + bookmarks
    await migrateDailyReactionsAndBookmarks(conn, sqlContent, validUserIds);

    // 10. Daily comment reactions
    await migrateDailyCommentReactions(conn, sqlContent, validUserIds, dailyCommentIds);

    // 11. Listen logs
    await migrateListenLogs(conn, sqlContent, validUserIds);

    // Re-enable FK checks
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    printReport(sqlFilePath, elapsed);

  } catch (error) {
    console.error('\n  ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
