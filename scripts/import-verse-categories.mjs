#!/usr/bin/env node
/**
 * FreeLuma Verse-by-Category Import Script
 *
 * Imports verse-by-category data from the old FreeLuma media database and uploads
 * CategoryPhotos.zip images to Backblaze B2.
 *
 * Phase 1: Parse old DB data from freelumamedia.sql
 * Phase 2: Insert verse_categories (10 categories)
 * Phase 3: Insert verse_category_content + translations (KJV base + NIV, NLT, NKJV, etc.)
 * Phase 4: Upload CategoryPhotos.zip images to B2
 * Phase 5: Summary
 *
 * Usage: node scripts/import-verse-categories.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local') });

const SQL_DUMP_PATH = path.join(PROJECT_ROOT, 'Old Database', 'freelumamedia.sql');
const ZIP_PATH = path.join(PROJECT_ROOT, 'CategoryPhotos.zip');

const BATCH_SIZE = 100;

// Category enum -> display name mapping (preserving order)
const CATEGORY_MAP = [
  { enumVal: 'HopeAndEncouragement', name: 'Hope & Encouragement', slug: 'hope-encouragement' },
  { enumVal: 'AnxietyAndStress', name: 'Anxiety & Stress', slug: 'anxiety-stress' },
  { enumVal: 'FaithAndTrust', name: 'Faith & Trust', slug: 'faith-trust' },
  { enumVal: 'HealingAndStrength', name: 'Healing & Strength', slug: 'healing-strength' },
  { enumVal: 'LoveAndRelationships', name: 'Love & Relationships', slug: 'love-relationships' },
  { enumVal: 'GratitudeAndThanksgiving', name: 'Gratitude & Thanksgiving', slug: 'gratitude-thanksgiving' },
  { enumVal: 'ForgivenessAndMercy', name: 'Forgiveness & Mercy', slug: 'forgiveness-mercy' },
  { enumVal: 'PeaceAndComfort', name: 'Peace & Comfort', slug: 'peace-comfort' },
  { enumVal: 'WisdomAndGuidance', name: 'Wisdom & Guidance', slug: 'wisdom-guidance' },
  { enumVal: 'CourageAndOvercomingFear', name: 'Courage & Overcoming Fear', slug: 'courage-overcoming-fear' },
];

// Stats tracking
const stats = {
  categories: { imported: 0 },
  verses: { imported: 0, skipped: 0 },
  translations: { imported: 0, skipped: 0 },
  media: { uploaded: 0, skipped: 0, failed: 0 },
  warnings: [],
};

// ─── SQL Parser (same pattern as import-old-data.mjs) ─────────────────────────

/**
 * Parse all INSERT statements for a given table from the SQL dump.
 * Returns array of row objects with column names as keys.
 */
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

/**
 * Parse VALUES section of an INSERT statement.
 * Handles: nested parens, escaped quotes, NULL, numbers, strings with HTML.
 */
function parseValues(sql, startPos, columns) {
  const rows = [];
  let pos = startPos;
  const len = sql.length;

  while (pos < len) {
    while (pos < len && /\s/.test(sql[pos])) pos++;

    if (sql[pos] !== '(') break;
    pos++; // skip opening (

    const values = [];
    let valueStart = pos;
    let inString = false;
    let depth = 0;

    while (pos < len) {
      const ch = sql[pos];

      if (inString) {
        if (ch === '\\') {
          pos += 2;
          continue;
        }
        if (ch === "'") {
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

/**
 * Parse a single SQL value string into a JS value.
 */
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

// ─── Text Cleaning ──────────────────────────────────────────────────────────

/**
 * Clean verse text: strip pilcrow marks, HTML tags, normalize quotes, trim.
 */
function cleanVerseText(text) {
  if (!text) return '';
  let cleaned = text;
  // Strip pilcrow marks (U+00B6)
  cleaned = cleaned.replace(/\u00B6/g, '');
  // Strip HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  // Normalize curly single quotes to straight
  cleaned = cleaned.replace(/[\u2018\u2019]/g, "'");
  // Normalize curly double quotes to straight
  cleaned = cleaned.replace(/[\u201C\u201D]/g, '"');
  // Decode common HTML entities
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#039;/g, "'");
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  // Trim whitespace
  cleaned = cleaned.trim();
  return cleaned;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Database Connection ─────────────────────────────────────────────────────

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
    database: process.env.DB_NAME || 'freeluma_dev',
    multipleStatements: true,
    charset: 'utf8mb4',
  });
}

// ─── Phase 1: Parse Old DB Data ─────────────────────────────────────────────

function parseOldData(sqlContent) {
  console.log('\n=== PHASE 1: PARSE OLD DB DATA ===');

  const allRows = parseTable(sqlContent, 'versebycategory');
  console.log(`  Parsed ${allRows.length} total rows from versebycategory table`);

  // Drop AMP translation rows
  const rows = allRows.filter(r => r.TranslationAbv !== 'AMP');
  const ampCount = allRows.length - rows.length;
  console.log(`  Dropped ${ampCount} AMP translation rows`);
  console.log(`  Remaining: ${rows.length} rows (KJV, NIV, and others)`);

  // Count unique translations
  const translationCounts = {};
  for (const r of rows) {
    translationCounts[r.TranslationAbv] = (translationCounts[r.TranslationAbv] || 0) + 1;
  }
  console.log('  Translations found:', translationCounts);

  // Count unique categories
  const uniqueCategories = new Set(rows.map(r => r.Category));
  console.log(`  Unique categories: ${uniqueCategories.size} -> ${[...uniqueCategories].join(', ')}`);

  return rows;
}

// ─── Phase 2: Insert verse_categories ────────────────────────────────────────

async function insertCategories(conn) {
  console.log('\n=== PHASE 2: INSERT VERSE CATEGORIES ===');

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  for (let i = 0; i < CATEGORY_MAP.length; i++) {
    const cat = CATEGORY_MAP[i];
    try {
      await conn.query(
        `INSERT IGNORE INTO verse_categories (name, slug, sort_order, active, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)`,
        [cat.name, cat.slug, i, now, now]
      );
    } catch (err) {
      console.error(`  ERROR inserting category "${cat.name}":`, err.message);
    }
  }

  // Get the inserted categories with their IDs
  const [catRows] = await conn.query('SELECT id, name FROM verse_categories ORDER BY sort_order');
  const categoryIdMap = new Map(); // name -> id
  for (const row of catRows) {
    categoryIdMap.set(row.name, row.id);
  }

  stats.categories.imported = catRows.length;
  console.log(`  Created ${catRows.length} verse categories`);

  return categoryIdMap;
}

// ─── Phase 3: Insert verse_category_content + translations ──────────────────

async function insertVersesAndTranslations(conn, parsedRows, categoryIdMap) {
  console.log('\n=== PHASE 3: INSERT VERSES & TRANSLATIONS ===');

  // Build enum -> display name lookup
  const enumToName = new Map();
  for (const cat of CATEGORY_MAP) {
    enumToName.set(cat.enumVal, cat.name);
  }

  // Group by (Category, VerseReference) to find unique verses
  // Each group contains all translations for that verse in that category
  const verseGroups = new Map(); // "Category|VerseReference" -> array of rows

  for (const row of parsedRows) {
    const key = `${row.Category}|${row.VerseReference}`;
    if (!verseGroups.has(key)) verseGroups.set(key, []);
    verseGroups.get(key).push(row);
  }

  console.log(`  Found ${verseGroups.size} unique verses across all categories`);

  // Insert verse_category_content rows
  let verseCount = 0;
  const contentValues = [];

  for (const [key, rows] of verseGroups) {
    const [categoryEnum, verseRef] = key.split('|');
    const categoryName = enumToName.get(categoryEnum);
    if (!categoryName) {
      stats.verses.skipped++;
      stats.warnings.push(`Unknown category enum: ${categoryEnum}`);
      continue;
    }

    const categoryId = categoryIdMap.get(categoryName);
    if (!categoryId) {
      stats.verses.skipped++;
      continue;
    }

    // Find KJV text; fall back to first available non-AMP
    let baseRow = rows.find(r => r.TranslationAbv === 'KJV');
    if (!baseRow) {
      baseRow = rows[0]; // first available
    }

    const contentText = cleanVerseText(baseRow.VerseText);
    if (!contentText) {
      stats.verses.skipped++;
      continue;
    }

    // Book: use the row's Book field, or extract from VerseReference if empty
    let book = baseRow.Book || '';
    if (!book) {
      // Try to extract book from verse reference, e.g. "Philippians 3:1" -> "Philippians"
      const refMatch = verseRef.match(/^(.+?)\s+\d/);
      if (refMatch) book = refMatch[1];
    }

    contentValues.push([categoryId, verseRef, contentText, book]);
    verseCount++;
  }

  // Batch insert content rows
  console.log(`  Inserting ${contentValues.length} verse content rows...`);
  let insertedCount = 0;
  for (const batch of chunk(contentValues, BATCH_SIZE)) {
    try {
      const [result] = await conn.query(
        `INSERT IGNORE INTO verse_category_content (category_id, verse_reference, content_text, book)
        VALUES ?`,
        [batch]
      );
      insertedCount += result.affectedRows;
    } catch (err) {
      console.error(`  ERROR batch inserting content:`, err.message);
      // Try individual inserts for this batch
      for (const row of batch) {
        try {
          const [r] = await conn.query(
            `INSERT IGNORE INTO verse_category_content (category_id, verse_reference, content_text, book)
            VALUES (?, ?, ?, ?)`,
            row
          );
          insertedCount += r.affectedRows;
        } catch (e) {
          stats.verses.skipped++;
          stats.warnings.push(`Failed to insert verse ${row[1]}: ${e.message}`);
        }
      }
    }

    if (insertedCount % 500 === 0 || insertedCount === contentValues.length) {
      process.stdout.write(`  Imported ${insertedCount}/${contentValues.length} verses...\r`);
    }
  }

  stats.verses.imported = insertedCount;
  console.log(`\n  Verses imported: ${insertedCount}, skipped: ${stats.verses.skipped}`);

  // Now build a lookup of (category_id, verse_reference) -> content_id
  console.log('  Building content ID lookup...');
  const [allContent] = await conn.query(
    'SELECT id, category_id, verse_reference FROM verse_category_content'
  );
  const contentIdMap = new Map(); // "categoryId|verseReference" -> content_id
  for (const row of allContent) {
    contentIdMap.set(`${row.category_id}|${row.verse_reference}`, row.id);
  }
  console.log(`  Content ID lookup: ${contentIdMap.size} entries`);

  // Insert translations for each verse
  console.log('  Inserting translations...');
  let translationCount = 0;
  const translationBatch = [];

  for (const [key, rows] of verseGroups) {
    const [categoryEnum, verseRef] = key.split('|');
    const categoryName = enumToName.get(categoryEnum);
    if (!categoryName) continue;

    const categoryId = categoryIdMap.get(categoryName);
    if (!categoryId) continue;

    const contentId = contentIdMap.get(`${categoryId}|${verseRef}`);
    if (!contentId) continue;

    // Collect all translations for this verse (including KJV)
    const seenTranslations = new Set();
    for (const row of rows) {
      const code = row.TranslationAbv;
      if (seenTranslations.has(code)) continue;
      seenTranslations.add(code);

      const translatedText = cleanVerseText(row.VerseText);
      if (!translatedText) continue;

      translationBatch.push([contentId, code, translatedText, 'database']);
    }
  }

  // Batch insert translations
  console.log(`  Inserting ${translationBatch.length} translation rows...`);
  for (const batch of chunk(translationBatch, BATCH_SIZE)) {
    try {
      const [result] = await conn.query(
        `INSERT IGNORE INTO verse_category_content_translations
          (verse_category_content_id, translation_code, translated_text, source)
        VALUES ?`,
        [batch]
      );
      translationCount += result.affectedRows;
    } catch (err) {
      console.error(`  ERROR batch inserting translations:`, err.message);
      for (const row of batch) {
        try {
          const [r] = await conn.query(
            `INSERT IGNORE INTO verse_category_content_translations
              (verse_category_content_id, translation_code, translated_text, source)
            VALUES (?, ?, ?, ?)`,
            row
          );
          translationCount += r.affectedRows;
        } catch (e) {
          stats.translations.skipped++;
        }
      }
    }

    if (translationCount % 500 === 0) {
      process.stdout.write(`  Imported ${translationCount} translations...\r`);
    }
  }

  stats.translations.imported = translationCount;
  console.log(`\n  Translations imported: ${translationCount}, skipped: ${stats.translations.skipped}`);
}

// ─── Phase 4: Upload CategoryPhotos.zip to B2 ──────────────────────────────

async function uploadCategoryPhotos(conn) {
  console.log('\n=== PHASE 4: UPLOAD CATEGORY PHOTOS TO B2 ===');

  // Check if CategoryPhotos.zip exists
  if (!fs.existsSync(ZIP_PATH)) {
    console.log('  WARNING: CategoryPhotos.zip not found at project root, skipping.');
    stats.warnings.push('CategoryPhotos.zip not found, media upload skipped');
    return;
  }

  // Check B2 env vars
  const b2Region = process.env.B2_REGION;
  const b2KeyId = process.env.B2_KEY_ID;
  const b2AppKey = process.env.B2_APP_KEY;
  const b2BucketName = process.env.B2_BUCKET_NAME;
  const cdnBaseUrl = process.env.CDN_BASE_URL;

  if (!b2Region || !b2KeyId || !b2AppKey || !b2BucketName) {
    console.log('  WARNING: B2 environment variables not configured, skipping media upload.');
    console.log('  Required: B2_REGION, B2_KEY_ID, B2_APP_KEY, B2_BUCKET_NAME');
    stats.warnings.push('B2 not configured, media upload skipped');
    return;
  }

  // Dynamic imports for optional dependencies
  const { default: AdmZip } = await import('adm-zip');
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const s3Client = new S3Client({
    endpoint: `https://s3.${b2Region}.backblazeb2.com`,
    region: b2Region,
    credentials: {
      accessKeyId: b2KeyId,
      secretAccessKey: b2AppKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  // Build base URL for media
  const baseUrl = cdnBaseUrl || `https://f005.backblazeb2.com/file/${b2BucketName}`;

  const zip = new AdmZip(ZIP_PATH);
  const entries = zip.getEntries();

  // Filter to image files, skip __MACOSX and directories
  const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  const imageEntries = entries.filter(entry => {
    if (entry.isDirectory) return false;
    if (entry.entryName.includes('__MACOSX')) return false;
    const ext = path.extname(entry.entryName).toLowerCase();
    return imageExtensions.has(ext);
  });

  console.log(`  Found ${imageEntries.length} images in CategoryPhotos.zip`);

  let uploaded = 0;
  let failed = 0;

  for (const entry of imageEntries) {
    // Strip directory prefix from filename
    const filename = path.basename(entry.entryName);
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : 'image/jpeg';

    const mediaKey = `category-media/${filename}`;
    const mediaUrl = `${baseUrl}/${mediaKey}`;

    try {
      // Check if this media_key already exists (for idempotency)
      const [existing] = await conn.query(
        'SELECT id FROM verse_category_media WHERE media_key = ? LIMIT 1',
        [mediaKey]
      );
      if (existing.length > 0) {
        stats.media.skipped++;
        uploaded++;
        if (uploaded % 100 === 0) {
          console.log(`  Processed ${uploaded}/${imageEntries.length} images (skipping existing)...`);
        }
        continue;
      }

      const fileBuffer = entry.getData();

      await s3Client.send(new PutObjectCommand({
        Bucket: b2BucketName,
        Key: mediaKey,
        Body: fileBuffer,
        ContentType: contentType,
      }));

      // Insert into verse_category_media (category_id=NULL for shared pool)
      await conn.query(
        `INSERT INTO verse_category_media (category_id, media_url, media_key)
        VALUES (NULL, ?, ?)`,
        [mediaUrl, mediaKey]
      );

      uploaded++;

      if (uploaded % 100 === 0) {
        console.log(`  Uploaded ${uploaded}/${imageEntries.length} images...`);
      }

      // 50ms delay between uploads to avoid rate limiting
      await sleep(50);
    } catch (err) {
      failed++;
      stats.warnings.push(`Failed to upload ${filename}: ${err.message}`);
      if (failed <= 5) {
        console.error(`  ERROR uploading ${filename}:`, err.message);
      }
      if (failed === 6) {
        console.error('  (suppressing further upload error messages...)');
      }
    }
  }

  stats.media.uploaded = uploaded;
  stats.media.failed = failed;
  console.log(`  Uploaded: ${uploaded}, Failed: ${failed}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('====================================================');
  console.log('  FreeLuma Verse-by-Category Import');
  console.log('====================================================');

  const start = Date.now();

  // Check SQL dump exists
  if (!fs.existsSync(SQL_DUMP_PATH)) {
    console.error(`ERROR: SQL dump not found at: ${SQL_DUMP_PATH}`);
    process.exit(1);
  }

  // Read SQL dump
  console.log(`\nReading SQL dump: ${SQL_DUMP_PATH}`);
  const sqlContent = fs.readFileSync(SQL_DUMP_PATH, 'utf8');
  console.log(`  Size: ${(sqlContent.length / 1024 / 1024).toFixed(1)} MB`);

  // Connect to DB
  const conn = await getConnection();
  console.log('Connected to database');

  try {
    // Disable FK checks for bulk import
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query("SET SESSION sql_mode = ''");

    // Phase 1: Parse old DB data
    const parsedRows = parseOldData(sqlContent);

    // Phase 2: Insert categories
    const categoryIdMap = await insertCategories(conn);

    // Phase 3: Insert verses and translations
    await insertVersesAndTranslations(conn, parsedRows, categoryIdMap);

    // Re-enable FK checks
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Phase 4: Upload category photos
    await uploadCategoryPhotos(conn);

    // Phase 5: Summary
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log('\n====================================================');
    console.log('  IMPORT SUMMARY');
    console.log('====================================================');
    console.log(`  Time: ${elapsed}s`);
    console.log(`  Categories:   ${stats.categories.imported}`);
    console.log(`  Verses:       ${stats.verses.imported} imported, ${stats.verses.skipped} skipped`);
    console.log(`  Translations: ${stats.translations.imported} imported, ${stats.translations.skipped} skipped`);
    console.log(`  Media:        ${stats.media.uploaded} uploaded, ${stats.media.skipped} skipped (existing), ${stats.media.failed} failed`);

    if (stats.warnings.length > 0) {
      console.log(`\n  Warnings (${stats.warnings.length}):`);
      for (const w of stats.warnings.slice(0, 20)) {
        console.log(`    - ${w}`);
      }
      if (stats.warnings.length > 20) {
        console.log(`    ... and ${stats.warnings.length - 20} more`);
      }
    }

    // Verification counts
    console.log('\n=== VERIFICATION ===');
    const tables = ['verse_categories', 'verse_category_content', 'verse_category_content_translations', 'verse_category_media'];
    for (const t of tables) {
      try {
        const [rows] = await conn.query(`SELECT COUNT(*) as c FROM \`${t}\``);
        console.log(`  ${t.padEnd(45)} ${String(rows[0].c).padStart(6)} rows`);
      } catch (e) {
        console.log(`  ${t.padEnd(45)} ERROR: ${e.message}`);
      }
    }

    // Show per-category verse counts
    console.log('\n  Per-category verse counts:');
    const [catCounts] = await conn.query(`
      SELECT vc.name, COUNT(vcc.id) as verse_count
      FROM verse_categories vc
      LEFT JOIN verse_category_content vcc ON vcc.category_id = vc.id
      GROUP BY vc.id, vc.name
      ORDER BY vc.sort_order
    `);
    for (const row of catCounts) {
      console.log(`    ${row.name.padEnd(35)} ${String(row.verse_count).padStart(5)} verses`);
    }

  } catch (error) {
    console.error('\nIMPORT ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await conn.end();
  }

  console.log('\nDone!');
}

main();
