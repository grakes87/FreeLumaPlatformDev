/**
 * Migration Mapping Spreadsheet Generator
 *
 * Parses the old FreeLuma SQL dump and generates an Excel spreadsheet
 * documenting how every table/column maps to the new schema.
 *
 * Usage: node scripts/generate-migration-mapping.mjs
 *
 * Phase 8 Plan 01: Users, Categories, Social domains
 * Phase 8 Plan 02: Daily Content, Verse, Chat, Notes, Notifications, Video domains
 */

import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

// ---------------------------------------------------------------------------
// Section A: Constants
// ---------------------------------------------------------------------------

const SQL_DUMP_PATH = path.resolve('Old Database/Main Free Luma Database.sql');
const OUTPUT_PATH = path.resolve('migration-mapping.xlsx');

const EXCLUDED_TABLES = [
  'workshops',
  'workshop_series',
  'workshop_interests',
  'workshop_invitations',
  'workshoplogs',
];

// Domain group order for sheet organization
const DOMAIN_GROUPS = [
  {
    name: 'Users Domain',
    tables: ['users', 'settings', 'subscribewebpushes'],
  },
  {
    name: 'Categories Domain',
    tables: ['categories', 'category_user_relations', 'homescreen_tile_categories'],
  },
  {
    name: 'Social/Posts Domain',
    tables: ['posts', 'comments', 'usercomments', 'follows'],
  },
  {
    name: 'Daily Content Domain',
    tables: ['dailyposts', 'dailypostcomments', 'dailypostusercomments', 'dailypostusers', 'dailychapters'],
  },
  {
    name: 'Verse Domain',
    tables: ['verses', 'verse_comments', 'verse_likes', 'verse_user_comments'],
  },
  {
    name: 'Chat Domain',
    tables: ['chats'],
  },
  {
    name: 'Notes Domain',
    tables: ['notes'],
  },
  {
    name: 'Notifications Domain',
    tables: ['notifications'],
  },
  {
    name: 'Video Domain',
    tables: ['uservideos', 'uservideorelations'],
  },
];

// All non-workshop tables in domain order
const ALL_TABLES = DOMAIN_GROUPS.flatMap(g => g.tables);

// Excel color constants (ARGB format)
const COLORS = {
  headerBlue: 'FF4472C4',
  headerWhite: 'FFFFFFFF',
  lightBlue: 'FFD9E2F3',
  lightGreen: 'FFE2EFDA',
  lightYellow: 'FFFFF2CC',
  lightGray: 'FFD9D9D9',
  mediumGray: 'FFD6D6D6',
};

// ---------------------------------------------------------------------------
// Section B: SQL Dump Parser
// ---------------------------------------------------------------------------

/**
 * Parse all CREATE TABLE statements from the SQL dump.
 * Returns Map<tableName, Array<{name, type, extra}>>
 */
function parseCreateTables(sql) {
  const tables = new Map();
  const regex = /CREATE TABLE `(\w+)` \(([\s\S]*?)\) ENGINE/g;
  let match;

  while ((match = regex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns = [];

    const lines = body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('`')) continue;

      // Match: `column_name` type_definition[,]
      const colMatch = trimmed.match(/^`(\w+)`\s+(.+?)(?:,\s*)?$/);
      if (colMatch) {
        columns.push({
          name: colMatch[1],
          type: colMatch[2].replace(/,\s*$/, ''),
        });
      }
    }

    tables.set(tableName, columns);
  }

  return tables;
}

/**
 * Parse value tuples from SQL INSERT statements.
 * Handles nested parentheses, escaped quotes, NULL, numbers, and strings.
 */
function parseTupleValues(tupleStr) {
  // tupleStr is the content inside (...) -- strip outer parens
  const content = tupleStr.trim();
  const inner = content.startsWith('(') ? content.slice(1, -1) : content;

  const values = [];
  let current = '';
  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'" && !inString) {
      inString = true;
      current += ch;
      continue;
    }

    if (ch === "'" && inString) {
      // Check for '' (escaped single quote in SQL)
      if (i + 1 < inner.length && inner[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }
      inString = false;
      current += ch;
      continue;
    }

    if (inString) {
      current += ch;
      continue;
    }

    // Not in string
    if (ch === '(') {
      depth++;
      current += ch;
      continue;
    }
    if (ch === ')') {
      depth--;
      current += ch;
      continue;
    }

    if (ch === ',' && depth === 0) {
      values.push(cleanSqlValue(current.trim()));
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    values.push(cleanSqlValue(current.trim()));
  }

  return values;
}

/**
 * Clean a raw SQL value string into a displayable value.
 */
function cleanSqlValue(val) {
  if (val === 'NULL') return null;
  if (val.startsWith("'") && val.endsWith("'")) {
    // Remove quotes and unescape
    let inner = val.slice(1, -1);
    inner = inner.replace(/\\'/g, "'");
    inner = inner.replace(/\\"/g, '"');
    inner = inner.replace(/\\\\/g, '\\');
    inner = inner.replace(/\\n/g, '\n');
    inner = inner.replace(/\\r/g, '\r');
    inner = inner.replace(/\\0/g, '\0');
    return inner;
  }
  // Numeric or other literal
  return val;
}

/**
 * Find all INSERT INTO statements for a given table.
 * Returns Array<{colList: string[], valuesBlock: string}>
 *
 * Uses character-by-character scanning to find the true end of each
 * INSERT statement (the semicolon outside of any string literal),
 * which is necessary because text_content in posts contains HTML
 * with semicolons (e.g. &nbsp;) inside SQL string literals.
 */
function findInsertStatements(sql, tableName) {
  const results = [];
  const needle = `INSERT INTO \`${tableName}\``;
  let searchStart = 0;

  while (true) {
    const pos = sql.indexOf(needle, searchStart);
    if (pos === -1) break;

    // Find the column list: everything between first ( and first ) after the table name
    const colStart = sql.indexOf('(', pos + needle.length);
    if (colStart === -1) { searchStart = pos + needle.length; continue; }
    const colEnd = sql.indexOf(')', colStart);
    if (colEnd === -1) { searchStart = pos + needle.length; continue; }

    const colList = sql.slice(colStart + 1, colEnd)
      .replace(/`/g, '')
      .split(',')
      .map(c => c.trim());

    // Find "VALUES" keyword after the column list
    const valuesIdx = sql.indexOf('VALUES', colEnd);
    if (valuesIdx === -1 || valuesIdx > colEnd + 20) {
      searchStart = colEnd;
      continue;
    }

    // Now scan forward from after VALUES to find the terminating semicolon
    // that is NOT inside a string literal
    let valuesStart = valuesIdx + 6; // skip "VALUES"
    // Skip whitespace/newlines
    while (valuesStart < sql.length && (sql[valuesStart] === ' ' || sql[valuesStart] === '\n' || sql[valuesStart] === '\r')) {
      valuesStart++;
    }

    // Scan for the terminating ; respecting string quoting
    let i = valuesStart;
    let inStr = false;
    let esc = false;
    let endPos = -1;

    while (i < sql.length) {
      const ch = sql[i];

      if (esc) {
        esc = false;
        i++;
        continue;
      }

      if (ch === '\\' && inStr) {
        esc = true;
        i++;
        continue;
      }

      if (ch === "'" && !inStr) {
        inStr = true;
        i++;
        continue;
      }

      if (ch === "'" && inStr) {
        // Check for '' escape
        if (i + 1 < sql.length && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        inStr = false;
        i++;
        continue;
      }

      if (inStr) {
        i++;
        continue;
      }

      if (ch === ';') {
        endPos = i;
        break;
      }

      i++;
    }

    if (endPos === -1) {
      searchStart = valuesStart;
      continue;
    }

    const valuesBlock = sql.slice(valuesStart, endPos);
    results.push({ colList, valuesBlock });
    searchStart = endPos + 1;
  }

  return results;
}

/**
 * Extract sample rows from INSERT statements for a given table.
 * Returns Array<Object> mapping column names to values.
 */
function extractSampleRows(sql, tableName, columnNames, limit = 5) {
  const rows = [];
  const inserts = findInsertStatements(sql, tableName);

  for (const { colList, valuesBlock } of inserts) {
    if (rows.length >= limit) break;

    // Parse individual row tuples using depth tracking
    const tuples = extractTuples(valuesBlock);

    for (const tuple of tuples) {
      if (rows.length >= limit) break;
      const values = parseTupleValues(tuple);
      const row = {};
      for (let i = 0; i < colList.length; i++) {
        row[colList[i]] = i < values.length ? values[i] : null;
      }
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Extract individual tuple strings from a VALUES block.
 * Tracks parenthesis depth and quote state to correctly identify tuple boundaries.
 */
function extractTuples(valuesBlock) {
  const tuples = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let current = '';
  let tupleStarted = false;

  for (let i = 0; i < valuesBlock.length; i++) {
    const ch = valuesBlock[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'" && !escaped) {
      if (!inString) {
        inString = true;
      } else {
        // Check for '' SQL escape
        if (i + 1 < valuesBlock.length && valuesBlock[i + 1] === "'") {
          current += "''";
          i++;
          continue;
        }
        inString = false;
      }
      current += ch;
      continue;
    }

    if (inString) {
      current += ch;
      continue;
    }

    if (ch === '(') {
      depth++;
      if (depth === 1) {
        tupleStarted = true;
        current = '(';
        continue;
      }
    }

    if (ch === ')') {
      depth--;
      if (depth === 0 && tupleStarted) {
        current += ')';
        tuples.push(current);
        current = '';
        tupleStarted = false;
        continue;
      }
    }

    if (tupleStarted) {
      current += ch;
    }
  }

  return tuples;
}

/**
 * Count total rows across all INSERT statements for a table.
 */
function countTableRows(sql, tableName) {
  let count = 0;
  const inserts = findInsertStatements(sql, tableName);

  for (const { valuesBlock } of inserts) {
    // Count tuples by tracking depth -- cheaper than full parse
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < valuesBlock.length; i++) {
      const ch = valuesBlock[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === "'" && !esc) {
        if (!inStr) { inStr = true; }
        else {
          if (i + 1 < valuesBlock.length && valuesBlock[i + 1] === "'") { i++; continue; }
          inStr = false;
        }
        continue;
      }
      if (inStr) continue;
      if (ch === '(') { depth++; }
      if (ch === ')') {
        depth--;
        if (depth === 0) count++;
      }
    }
  }

  return count;
}

/**
 * Extract AUTO_INCREMENT value for a table from the SQL dump.
 */
function getAutoIncrement(sql, tableName) {
  const regex = new RegExp(
    `ALTER TABLE \`${tableName}\`\\s*\\n\\s*MODIFY.*AUTO_INCREMENT=(\\d+)`,
    'm'
  );
  const match = sql.match(regex);
  return match ? parseInt(match[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Section C: Excel Framework
// ---------------------------------------------------------------------------

function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FreeLuma Migration Tool';
  workbook.created = new Date();
  return workbook;
}

function applyHeaderStyle(row, bgColor = COLORS.headerBlue, fontColor = COLORS.headerWhite) {
  row.font = { bold: true, color: { argb: fontColor }, size: 11 };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: bgColor },
  };
  row.alignment = { vertical: 'middle', wrapText: true };
}

function applySectionHeaderStyle(row, bgColor = COLORS.mediumGray) {
  row.font = { bold: true, size: 12 };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: bgColor },
  };
}

/**
 * Create the Overview sheet listing all tables.
 */
function createOverviewSheet(workbook, tableSchemas, sql) {
  const sheet = workbook.addWorksheet('Overview', {
    properties: { tabColor: { argb: COLORS.headerBlue } },
  });

  sheet.columns = [
    { header: 'Old Table', key: 'oldTable', width: 30 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'New Table(s)', key: 'newTables', width: 35 },
    { header: 'Row Count', key: 'rowCount', width: 15 },
    { header: 'Notes', key: 'notes', width: 55 },
  ];

  // Style header row
  applyHeaderStyle(sheet.getRow(1));

  // Overview data for all non-workshop tables
  const overviewData = getOverviewData();

  for (const entry of overviewData) {
    const rowCount = countTableRows(sql, entry.oldTable);
    const autoInc = getAutoIncrement(sql, entry.oldTable);
    const row = sheet.addRow({
      oldTable: entry.oldTable,
      status: entry.status,
      newTables: entry.newTables,
      rowCount: rowCount || entry.approxRows || 0,
      notes: entry.notes + (autoInc ? ` (AUTO_INCREMENT: ${autoInc})` : ''),
    });

    // Color-code rows by status
    if (entry.status === 'NEEDS DECISION') {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.lightYellow },
      };
      row.font = { bold: true };
    } else if (entry.status === 'EXCLUDED') {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.lightGray },
      };
    } else if (entry.status === 'MAPPED') {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.lightGreen },
      };
    }
  }

  // Add excluded workshop tables
  for (const tableName of EXCLUDED_TABLES) {
    const rowCount = countTableRows(sql, tableName);
    const autoInc = getAutoIncrement(sql, tableName);
    const row = sheet.addRow({
      oldTable: tableName,
      status: 'EXCLUDED',
      newTables: '(rebuilt in Phase 5)',
      rowCount: rowCount || 0,
      notes: `Workshop table -- rebuilt from scratch in Phase 5.${autoInc ? ` (AUTO_INCREMENT: ${autoInc})` : ''}`,
    });
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.lightGray },
    };
  }

  // Auto-filter
  sheet.autoFilter = {
    from: 'A1',
    to: 'E1',
  };

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return sheet;
}

/**
 * Create a detailed table sheet with column mapping, relationships, and sample data.
 */
function createTableSheet(workbook, tableName, config, sampleData, columnNames) {
  // Sheet name max 31 chars in Excel
  const sheetName = tableName.length > 31 ? tableName.slice(0, 31) : tableName;
  const sheet = workbook.addWorksheet(sheetName);

  // Row 1: Title
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Table: ${tableName}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'left' };

  // Row 2: Blank
  sheet.addRow([]);

  // Row 3: Column mapping headers
  const mappingHeaders = [
    'Old Column', 'Old Type', 'New Table', 'New Column', 'New Type',
    'Transformation Rule', 'Sample Old Value', 'Expected New Value', 'Data Quality Notes',
  ];
  const headerRow = sheet.addRow(mappingHeaders);
  applyHeaderStyle(headerRow, COLORS.lightBlue, 'FF000000');

  // Set column widths
  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 22;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 20;
  sheet.getColumn(6).width = 35;
  sheet.getColumn(7).width = 28;
  sheet.getColumn(8).width = 28;
  sheet.getColumn(9).width = 35;

  // Column mapping data rows
  for (const col of config.columns) {
    // Try to find sample value from first row
    let sampleOld = '';
    if (sampleData.length > 0 && col.oldCol !== '(new)') {
      const val = sampleData[0][col.oldCol];
      sampleOld = val !== null && val !== undefined ? truncateValue(String(val), 200) : 'NULL';
    }

    const row = sheet.addRow([
      col.oldCol,
      col.oldType || '',
      col.newTable || '',
      col.newCol || '',
      col.newType || '',
      col.transform || '',
      sampleOld,
      '', // Expected new value -- left for manual review
      col.quality || '',
    ]);

    // Highlight NEEDS DECISION cells
    if (col.transform && col.transform.includes('NEEDS DECISION')) {
      row.getCell(6).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.lightYellow },
      };
      row.getCell(6).font = { bold: true };
    }

    // Style COMPUTED cells
    if (col.transform && col.transform.includes('COMPUTED')) {
      row.getCell(6).font = { italic: true, color: { argb: 'FF808080' } };
    }

    // Style (new) source columns
    if (col.oldCol === '(new)') {
      row.getCell(1).font = { italic: true, color: { argb: 'FF808080' } };
      row.getCell(2).font = { italic: true, color: { argb: 'FF808080' } };
    }
  }

  // Blank separator
  sheet.addRow([]);

  // Relationships section
  if (config.relationships && config.relationships.length > 0) {
    const relHeaderRow = sheet.addRow(['RELATIONSHIPS']);
    sheet.mergeCells(`A${relHeaderRow.number}:I${relHeaderRow.number}`);
    applySectionHeaderStyle(relHeaderRow);

    const relColHeaders = sheet.addRow([
      'Type', 'From', 'To', 'Description', 'New Schema Equivalent',
    ]);
    applyHeaderStyle(relColHeaders, COLORS.lightBlue, 'FF000000');

    for (const rel of config.relationships) {
      sheet.addRow([
        rel.type,
        rel.from,
        rel.to,
        rel.desc,
        rel.newEquiv || '',
      ]);
    }

    sheet.addRow([]);
  }

  // Sample data section
  if (sampleData.length > 0 && columnNames.length > 0) {
    const sampleHeaderRow = sheet.addRow([`SAMPLE DATA (${sampleData.length} rows)`]);
    sheet.mergeCells(`A${sampleHeaderRow.number}:I${sampleHeaderRow.number}`);
    applySectionHeaderStyle(sampleHeaderRow);

    // Column name headers for sample data
    const sampleColRow = sheet.addRow(columnNames);
    applyHeaderStyle(sampleColRow, COLORS.lightBlue, 'FF000000');

    for (const dataRow of sampleData) {
      const values = columnNames.map(col => {
        const v = dataRow[col];
        if (v === null || v === undefined) return 'NULL';
        return truncateValue(String(v), 300);
      });
      sheet.addRow(values);
    }
  }

  // Auto-filter on mapping header (row 3)
  sheet.autoFilter = {
    from: 'A3',
    to: 'I3',
  };

  // Freeze panes at row 4
  sheet.views = [{ state: 'frozen', ySplit: 3 }];

  return sheet;
}

function truncateValue(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

// ---------------------------------------------------------------------------
// Section D: Mapping Configuration -- Users Domain
// ---------------------------------------------------------------------------

const USERS_MAPPING = {
  oldTable: 'users',
  status: 'MAPPED',
  newTables: ['users', 'user_settings'],
  notes: 'Split: profile fields to users, preferences to user_settings. 30+ column transformations.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'users', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy (preserve IDs)', quality: '' },
    { oldCol: 'first_name', oldType: 'varchar(255)', newTable: 'users', newCol: 'display_name', newType: 'VARCHAR(100)', transform: 'merge with last_name: first_name + " " + last_name (trim if last_name empty)', quality: 'Some accounts have empty first_name' },
    { oldCol: 'last_name', oldType: 'varchar(255)', newTable: 'users', newCol: '(merged into display_name)', newType: '--', transform: 'merge with first_name (see above)', quality: 'Often empty for newer accounts' },
    { oldCol: 'username', oldType: 'varchar(255)', newTable: 'users', newCol: 'username', newType: 'VARCHAR(30)', transform: 'direct copy', quality: 'First ~85 IDs are test accounts (test1234, shady123, etc.)' },
    { oldCol: 'email', oldType: 'varchar(255)', newTable: 'users', newCol: 'email', newType: 'VARCHAR(255)', transform: 'direct copy', quality: 'Unique constraint' },
    { oldCol: 'password', oldType: 'varchar(255)', newTable: 'users', newCol: 'password_hash', newType: 'VARCHAR(255)', transform: 'replace $2y$ prefix with $2b$ for bcrypt compat; FLAG plaintext passwords for forced reset', quality: 'HIGH: At least 1 plaintext password found (user_id=6). Most are $2y$10$ format' },
    { oldCol: 'profile_picture', oldType: 'varchar(255)', newTable: 'users', newCol: 'avatar_url', newType: 'VARCHAR(500)', transform: 'prefix with B2 storage URL path (MIG-08); handle "default.jpg" as NULL', quality: 'Mix of filenames: default.jpg, username.jpg, username.png' },
    { oldCol: 'city', oldType: 'varchar(255)', newTable: 'users', newCol: 'location', newType: 'VARCHAR(100)', transform: 'merge: city + ", " + state + ", " + country (filter empties)', quality: '' },
    { oldCol: 'state', oldType: 'varchar(255)', newTable: 'users', newCol: '(merged into location)', newType: '--', transform: 'merge with city and country (see above)', quality: '' },
    { oldCol: 'followings_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from follows table) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'posts_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from posts table) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'users', newCol: 'created_at', newType: 'DATE', transform: 'direct copy (preserve original registration date)', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'users', newCol: 'updated_at', newType: 'DATE', transform: 'direct copy', quality: '' },
    { oldCol: 'liked_posts', oldType: 'longtext (JSON)', newTable: 'post_reactions', newCol: 'post_id + user_id + reaction_type', newType: 'See post_reactions model', transform: 'parse JSON array of post IDs -> create PostReaction row per ID with reaction_type="like"', quality: 'LOW: JSON array may contain IDs of deleted posts (orphan check needed)' },
    { oldCol: 'dob', oldType: 'date', newTable: 'users', newCol: 'date_of_birth', newType: 'DATEONLY', transform: 'rename; convert 0000-00-00 to NULL', quality: 'MEDIUM: Contains 0000-00-00 invalid dates for many users' },
    { oldCol: 'phone', oldType: 'varchar(255)', newTable: '--', newCol: '--', newType: '--', transform: 'NEEDS DECISION: no phone column in new schema', quality: 'Some users have phone numbers stored' },
    { oldCol: 'followers_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from follows table) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'bookmark_setting', oldType: "varchar(255) DEFAULT 'FLP'", newTable: 'users', newCol: 'preferred_translation', newType: 'VARCHAR(10)', transform: 'rename; maps Bible translation preference (e.g. KJV, NIV, NIRV, FLP)', quality: 'NEEDS DECISION: also see bible_setting column -- which one maps?' },
    { oldCol: 'bible_setting', oldType: "varchar(255) DEFAULT 'FLP'", newTable: '--', newCol: '--', newType: '--', transform: 'NEEDS DECISION: may duplicate bookmark_setting or carry different meaning', quality: 'Show sample values to user for decision' },
    { oldCol: 'notification_preference', oldType: 'longtext (JSON)', newTable: 'user_settings', newCol: 'multiple columns', newType: 'See user_settings model', transform: 'parse JSON -> split into email_dm, email_follow, email_prayer, email_daily_reminder boolean settings', quality: '' },
    { oldCol: 'account_visibility', oldType: "enum('PUBLIC','PRIVATE')", newTable: 'users', newCol: 'profile_privacy', newType: "ENUM('public','private')", transform: 'lowercase: PUBLIC->public, PRIVATE->private', quality: '' },
    { oldCol: 'daily_post_notification_time', oldType: 'time', newTable: 'user_settings', newCol: 'daily_reminder_time', newType: 'STRING', transform: 'move to user_settings table; convert TIME to string HH:MM', quality: '' },
    { oldCol: 'tile_category', oldType: 'varchar(255)', newTable: '--', newCol: '--', newType: '--', transform: 'NEEDS DECISION: relates to homescreen_tile_categories, no equivalent in new schema', quality: '' },
    { oldCol: 'top_slide_preference', oldType: 'varchar(255)', newTable: '--', newCol: '--', newType: '--', transform: 'NEEDS DECISION: no equivalent in new schema', quality: '' },
    { oldCol: 'comment_hidden', oldType: 'tinyint(1) NOT NULL DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'NEEDS DECISION: no direct equivalent in new schema', quality: '' },
    { oldCol: 'country', oldType: "varchar(255) DEFAULT 'United States'", newTable: 'users', newCol: '(merged into location)', newType: '--', transform: 'merge with city and state (see location)', quality: '' },
    // New schema columns with no old source
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'google_id', newType: 'VARCHAR(255)', transform: 'COMPUTED in new schema -- default NULL, no migration needed', quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'apple_id', newType: 'VARCHAR(255)', transform: 'COMPUTED in new schema -- default NULL, no migration needed', quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'avatar_color', newType: 'CHAR(7)', transform: 'COMPUTED in new schema -- generate random hex color', quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'bio', newType: 'TEXT', transform: 'COMPUTED in new schema -- default NULL (old schema has no bio column)', quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'mode', newType: "ENUM('bible','positivity')", transform: "derive from category_user_relations: if user has BIBLE category -> 'bible', POSITIVITY -> 'positivity', default 'bible'", quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'timezone', newType: 'VARCHAR(50)', transform: "default 'America/New_York'", quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'language', newType: 'VARCHAR(5)', transform: "default 'en'", quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'email_verified', newType: 'BOOLEAN', transform: 'default true for migrated users', quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'onboarding_complete', newType: 'BOOLEAN', transform: 'default true for migrated users', quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'status', newType: "ENUM('active','deactivated','deleted')", transform: "default 'active'", quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'users', newCol: 'role', newType: "ENUM('user','moderator')", transform: "default 'user'", quality: '' },
  ],
  relationships: [
    { type: '1:N', from: 'users.id', to: 'category_user_relations.user_id', desc: 'User category preferences', newEquiv: 'users.id -> user_categories.user_id' },
    { type: '1:N', from: 'users.id', to: 'posts.user_id', desc: 'User posts', newEquiv: 'users.id -> posts.user_id' },
    { type: '1:N', from: 'users.id', to: 'follows.follower_id / following_id', desc: 'Social graph', newEquiv: 'users.id -> follows.follower_id / following_id' },
    { type: '1:N', from: 'users.id', to: 'chats.sender_id / receiver_id', desc: 'Chat messages', newEquiv: 'users.id -> messages.sender_id (via conversations)' },
    { type: '1:N', from: 'users.id', to: 'notifications.user_id / action_done_by', desc: 'Notification targets/actors', newEquiv: 'users.id -> notifications.recipient_id / actor_id' },
    { type: 'JSON M:N', from: 'users.liked_posts', to: 'posts.id', desc: 'User liked posts (implicit, JSON array)', newEquiv: 'post_reactions (user_id + post_id)' },
  ],
};

const SETTINGS_MAPPING = {
  oldTable: 'settings',
  status: 'MAPPED',
  newTables: ['platform_settings'],
  notes: 'Simple key-value settings table. Only 2 rows.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'platform_settings', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'key_name', oldType: 'varchar(255) NOT NULL', newTable: 'platform_settings', newCol: 'key', newType: 'VARCHAR(255)', transform: 'rename: key_name -> key', quality: '' },
    { oldCol: 'value', oldType: 'varchar(255)', newTable: 'platform_settings', newCol: 'value', newType: 'VARCHAR(255)', transform: 'direct copy', quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'platform_settings', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'platform_settings', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
  ],
  relationships: [],
};

const SUBSCRIBEWEBPUSHES_MAPPING = {
  oldTable: 'subscribewebpushes',
  status: 'MAPPED',
  newTables: ['push_subscriptions'],
  notes: 'Web push notification subscriptions. 78 rows.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'push_subscriptions', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'user', oldType: 'int(11) NOT NULL', newTable: 'push_subscriptions', newCol: 'user_id', newType: 'INTEGER', transform: 'rename: user -> user_id', quality: '' },
    { oldCol: 'subscription', oldType: 'longtext (JSON)', newTable: 'push_subscriptions', newCol: 'subscription', newType: 'JSON', transform: 'direct copy (JSON structure)', quality: 'Contains endpoint, keys.p256dh, keys.auth' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'push_subscriptions', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'push_subscriptions', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
  ],
  relationships: [
    { type: '1:N', from: 'users.id', to: 'subscribewebpushes.user', desc: 'User push subscriptions', newEquiv: 'users.id -> push_subscriptions.user_id' },
  ],
};

// ---------------------------------------------------------------------------
// Section E: Mapping Configuration -- Categories Domain
// ---------------------------------------------------------------------------

const CATEGORIES_MAPPING = {
  oldTable: 'categories',
  status: 'MAPPED',
  newTables: ['categories'],
  notes: 'Simple 1:1 mapping. Only 2 rows (BIBLE, POSITIVITY).',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'categories', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'category_name', oldType: 'varchar(255) NOT NULL', newTable: 'categories', newCol: 'name', newType: 'VARCHAR(100)', transform: 'rename: category_name -> name', quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'categories', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'categories', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
  ],
  relationships: [
    { type: '1:N', from: 'categories.id', to: 'category_user_relations.category_id', desc: 'Category user assignments', newEquiv: 'categories.id -> user_categories.category_id' },
    { type: '1:N', from: 'categories.id', to: 'posts.category_id', desc: 'Post category', newEquiv: 'posts.mode derived from category_id' },
  ],
};

const CATEGORY_USER_RELATIONS_MAPPING = {
  oldTable: 'category_user_relations',
  status: 'MAPPED',
  newTables: ['user_categories'],
  notes: 'Simple rename mapping. ~44,631 rows.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'user_categories', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: 'user_categories', newCol: 'user_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'category_id', oldType: 'int(11) NOT NULL', newTable: 'user_categories', newCol: 'category_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'user_categories', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'user_categories', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'category_user_relations.user_id', to: 'users.id', desc: 'Belongs to user', newEquiv: 'user_categories.user_id -> users.id' },
    { type: 'N:1', from: 'category_user_relations.category_id', to: 'categories.id', desc: 'Belongs to category', newEquiv: 'user_categories.category_id -> categories.id' },
  ],
};

const HOMESCREEN_TILE_CATEGORIES_MAPPING = {
  oldTable: 'homescreen_tile_categories',
  status: 'NEEDS DECISION',
  newTables: ['(no direct equivalent)'],
  notes: 'NEEDS DECISION: 10 category entries for homescreen tiles. No direct mapping in new schema. Options: (a) map to video_categories, (b) drop, (c) create new model.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: no direct equivalent', quality: '' },
    { oldCol: 'name', oldType: 'varchar(255)', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: category names like hopeandencouragement, anxietyandstress, etc.', quality: '10 categories total' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
  ],
  relationships: [
    { type: 'Implicit', from: 'homescreen_tile_categories.id', to: 'users.tile_category', desc: 'Referenced by users.tile_category (implicit, no FK)', newEquiv: '(no equivalent)' },
  ],
};

// ---------------------------------------------------------------------------
// Section F: Mapping Configuration -- Social Domain
// ---------------------------------------------------------------------------

const POSTS_MAPPING = {
  oldTable: 'posts',
  status: 'MAPPED',
  newTables: ['posts', 'post_media', 'prayer_requests'],
  notes: 'COMPLEX: Split by post_type: FEED -> posts (post_type=text), PRAYER_WALL -> posts (post_type=prayer_request) + prayer_requests row. WARNING: Only ~42 rows in SQL dump but AUTO_INCREMENT=1230 suggests ~1200+ actual posts.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'posts', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy (preserve IDs)', quality: '' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: 'posts', newCol: 'user_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'text_content', oldType: 'text', newTable: 'posts', newCol: 'body', newType: 'TEXT', transform: 'rename; strip HTML tags (<p>, <span>, inline styles); decode HTML entities', quality: 'MEDIUM: Contains HTML markup with inline styles, empty <p></p> tags, and unicode escape sequences (U+1F64F)' },
    { oldCol: 'post_type', oldType: "enum('PRAYER_WALL','FEED')", newTable: 'posts', newCol: 'post_type', newType: "ENUM('text','prayer_request','testimony')", transform: "Map: FEED -> 'text', PRAYER_WALL -> 'prayer_request'. For PRAYER_WALL posts: also create prayer_requests row", quality: '' },
    { oldCol: 'media', oldType: 'longtext (JSON)', newTable: 'post_media', newCol: 'multiple rows', newType: 'See post_media model', transform: 'parse JSON array [{file_name, file_type}] -> create PostMedia row per item with media_type and media_url', quality: 'Mix of image and video. Some have [], some NULL. file_type is "image" or "video"' },
    { oldCol: 'cover_media', oldType: 'int(11)', newTable: '--', newCol: '--', newType: '--', transform: 'NEEDS DECISION: appears to be index into media array for cover image. May map to post_media.display_order or is_cover flag', quality: 'Values: NULL, 0, 1. Meaning unclear -- 0 vs NULL distinction needed' },
    { oldCol: 'likes_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from post_reactions) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'comments_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from post_comments) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'shares_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'is_updated', oldType: 'tinyint(1) DEFAULT 0', newTable: 'posts', newCol: 'edited', newType: 'BOOLEAN', transform: 'rename: is_updated -> edited', quality: '' },
    { oldCol: 'is_deleted', oldType: 'tinyint(1) DEFAULT 0', newTable: 'posts', newCol: 'deleted_at', newType: 'DATE (paranoid)', transform: 'Convert: is_deleted=1 -> deleted_at=updatedAt timestamp; is_deleted=0 -> deleted_at=NULL', quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'posts', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'posts', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'category_id', oldType: 'int(11)', newTable: 'posts', newCol: 'mode', newType: "ENUM('bible','positivity')", transform: "Map: category_id=1 (BIBLE) -> 'bible', category_id=2 (POSITIVITY) -> 'positivity'", quality: '' },
    // For PRAYER_WALL posts, also create prayer_requests row
    { oldCol: '(derived)', oldType: '--', newTable: 'prayer_requests', newCol: 'post_id', newType: 'INTEGER', transform: 'For PRAYER_WALL posts only: create prayer_requests row with post_id, status=active, is_anonymous=false', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'posts.user_id', to: 'users.id', desc: 'Post author', newEquiv: 'posts.user_id -> users.id' },
    { type: '1:N', from: 'posts.id', to: 'comments.post_id', desc: 'Post comments', newEquiv: 'posts.id -> post_comments.post_id' },
    { type: 'JSON 1:N', from: 'posts.media', to: '(inline JSON)', desc: 'Post media (embedded JSON)', newEquiv: 'posts.id -> post_media.post_id (normalized)' },
    { type: 'JSON M:N', from: 'users.liked_posts', to: 'posts.id', desc: 'Liked by users (implicit via users.liked_posts JSON)', newEquiv: 'post_reactions (user_id + post_id)' },
    { type: 'N:1', from: 'posts.category_id', to: 'categories.id', desc: 'Post category', newEquiv: 'posts.mode derived from category_id' },
  ],
};

const COMMENTS_MAPPING = {
  oldTable: 'comments',
  status: 'MAPPED',
  newTables: ['post_comments'],
  notes: 'Post comments with self-referential threading (parent_id). ~620 rows.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'post_comments', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'post_id', oldType: 'int(11) NOT NULL', newTable: 'post_comments', newCol: 'post_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: 'post_comments', newCol: 'user_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'parent_id', oldType: 'int(11) NOT NULL DEFAULT 0', newTable: 'post_comments', newCol: 'parent_id', newType: 'INTEGER (nullable)', transform: 'Convert: parent_id=0 -> parent_id=NULL (root comment); otherwise direct copy', quality: 'MEDIUM: Uses 0 instead of NULL for root-level comments' },
    { oldCol: 'text_content', oldType: 'text', newTable: 'post_comments', newCol: 'body', newType: 'TEXT', transform: 'rename: text_content -> body', quality: '' },
    { oldCol: 'likes_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from post_comment_reactions) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'is_deleted', oldType: 'tinyint(1) DEFAULT 0', newTable: 'post_comments', newCol: 'deleted_at', newType: 'DATE (paranoid)', transform: 'Convert: is_deleted=1 -> deleted_at=updatedAt; is_deleted=0 -> NULL', quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'post_comments', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'post_comments', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'reply_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT of children) -- no migration needed', quality: 'Denormalized counter' },
  ],
  relationships: [
    { type: 'N:1', from: 'comments.post_id', to: 'posts.id', desc: 'Belongs to post', newEquiv: 'post_comments.post_id -> posts.id' },
    { type: 'N:1', from: 'comments.user_id', to: 'users.id', desc: 'Comment author', newEquiv: 'post_comments.user_id -> users.id' },
    { type: 'Self 1:N', from: 'comments.parent_id', to: 'comments.id', desc: 'Reply threading', newEquiv: 'post_comments.parent_id -> post_comments.id' },
    { type: '1:N', from: 'comments.id', to: 'usercomments.comment_id', desc: 'Comment likes/reactions', newEquiv: 'post_comments.id -> post_comment_reactions.comment_id' },
  ],
};

const USERCOMMENTS_MAPPING = {
  oldTable: 'usercomments',
  status: 'MAPPED',
  newTables: ['post_comment_reactions'],
  notes: 'Comment like/reaction pivot table. ~494 rows.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'post_comment_reactions', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'comment_id', oldType: 'int(11) NOT NULL', newTable: 'post_comment_reactions', newCol: 'comment_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: 'post_comment_reactions', newCol: 'user_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'is_liked', oldType: 'tinyint(1) DEFAULT 0', newTable: 'post_comment_reactions', newCol: 'reaction_type', newType: "ENUM('like','love','pray','amen','praise')", transform: "Map: is_liked=1 -> reaction_type='like'. Old schema only has like, no emoji types.", quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'post_comment_reactions', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'post_comment_reactions', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'usercomments.comment_id', to: 'comments.id', desc: 'Reaction on comment', newEquiv: 'post_comment_reactions.comment_id -> post_comments.id' },
    { type: 'N:1', from: 'usercomments.user_id', to: 'users.id', desc: 'Reaction by user', newEquiv: 'post_comment_reactions.user_id -> users.id' },
  ],
};

const FOLLOWS_MAPPING = {
  oldTable: 'follows',
  status: 'MAPPED',
  newTables: ['follows'],
  notes: 'Social graph follows. ~1,194 rows.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'follows', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'follower_id', oldType: 'int(11) NOT NULL', newTable: 'follows', newCol: 'follower_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'following_id', oldType: 'int(11) NOT NULL', newTable: 'follows', newCol: 'following_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'status', oldType: 'tinyint(1) NOT NULL DEFAULT 0', newTable: 'follows', newCol: 'status', newType: "ENUM('active','pending')", transform: "Map: 1 -> 'active', 0 -> 'pending'", quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'follows', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'follows', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'request_follow', oldType: 'tinyint(1) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'REDUNDANT with status (status=0 already means pending). No migration needed.', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'follows.follower_id', to: 'users.id', desc: 'Follower user', newEquiv: 'follows.follower_id -> users.id' },
    { type: 'N:1', from: 'follows.following_id', to: 'users.id', desc: 'Followed user', newEquiv: 'follows.following_id -> users.id' },
  ],
};

// ---------------------------------------------------------------------------
// All mapping configs indexed by table name
// ---------------------------------------------------------------------------

const TABLE_MAPPINGS = {
  users: USERS_MAPPING,
  settings: SETTINGS_MAPPING,
  subscribewebpushes: SUBSCRIBEWEBPUSHES_MAPPING,
  categories: CATEGORIES_MAPPING,
  category_user_relations: CATEGORY_USER_RELATIONS_MAPPING,
  homescreen_tile_categories: HOMESCREEN_TILE_CATEGORIES_MAPPING,
  posts: POSTS_MAPPING,
  comments: COMMENTS_MAPPING,
  usercomments: USERCOMMENTS_MAPPING,
  follows: FOLLOWS_MAPPING,
};

// ---------------------------------------------------------------------------
// Section G: Overview Data for ALL tables
// ---------------------------------------------------------------------------

function getOverviewData() {
  return [
    // Users Domain
    { oldTable: 'users', status: 'MAPPED', newTables: 'users + user_settings', approxRows: 32319, notes: 'Split: profile to users, settings to user_settings. 30+ column transformations.' },
    { oldTable: 'settings', status: 'MAPPED', newTables: 'platform_settings', approxRows: 2, notes: 'Simple key-value settings.' },
    { oldTable: 'subscribewebpushes', status: 'MAPPED', newTables: 'push_subscriptions', approxRows: 78, notes: 'Web push notification subscriptions.' },
    // Categories Domain
    { oldTable: 'categories', status: 'MAPPED', newTables: 'categories', approxRows: 2, notes: 'Simple 1:1 mapping. BIBLE and POSITIVITY.' },
    { oldTable: 'category_user_relations', status: 'MAPPED', newTables: 'user_categories', approxRows: 44631, notes: 'Simple rename mapping.' },
    { oldTable: 'homescreen_tile_categories', status: 'NEEDS DECISION', newTables: '(no direct equivalent)', approxRows: 10, notes: 'NEEDS DECISION: 10 homescreen tile categories. No new schema equivalent.' },
    // Social Domain
    { oldTable: 'posts', status: 'MAPPED', newTables: 'posts + post_media + prayer_requests', approxRows: 42, notes: 'COMPLEX: Type split FEED/PRAYER_WALL. WARNING: Only ~42 rows in dump, AUTO_INCREMENT=1230.' },
    { oldTable: 'comments', status: 'MAPPED', newTables: 'post_comments', approxRows: 620, notes: 'Post comments with threading (parent_id).' },
    { oldTable: 'usercomments', status: 'MAPPED', newTables: 'post_comment_reactions', approxRows: 494, notes: 'Comment like/reaction pivot.' },
    { oldTable: 'follows', status: 'MAPPED', newTables: 'follows', approxRows: 1194, notes: 'Social graph follows.' },
    // Daily Content Domain (detailed sheets in Plan 02)
    { oldTable: 'dailyposts', status: 'MAPPED', newTables: 'daily_content', approxRows: 702, notes: 'Detailed sheet: see Plan 02' },
    { oldTable: 'dailypostcomments', status: 'MAPPED', newTables: 'daily_comments', approxRows: 3146, notes: 'Detailed sheet: see Plan 02' },
    { oldTable: 'dailypostusercomments', status: 'NEEDS DECISION', newTables: 'daily_reactions (on comments)', approxRows: 6733, notes: 'Detailed sheet: see Plan 02. NEEDS DECISION on target model.' },
    { oldTable: 'dailypostusers', status: 'MAPPED', newTables: 'daily_reactions + bookmarks', approxRows: 23685, notes: 'Detailed sheet: see Plan 02. Splits by is_liked/is_bookmarked flags.' },
    { oldTable: 'dailychapters', status: 'MAPPED', newTables: 'listen_logs', approxRows: 1737, notes: 'Detailed sheet: see Plan 02' },
    // Verse Domain (detailed sheets in Plan 02)
    { oldTable: 'verses', status: 'NEEDS DECISION', newTables: '(no direct equivalent)', approxRows: 3409, notes: 'Detailed sheet: see Plan 02. NEEDS DECISION.' },
    { oldTable: 'verse_comments', status: 'NEEDS DECISION', newTables: '(no direct equivalent)', approxRows: 42, notes: 'Detailed sheet: see Plan 02. NEEDS DECISION.' },
    { oldTable: 'verse_likes', status: 'NEEDS DECISION', newTables: '(no direct equivalent)', approxRows: 3716, notes: 'Detailed sheet: see Plan 02. NEEDS DECISION.' },
    { oldTable: 'verse_user_comments', status: 'NEEDS DECISION', newTables: '(no direct equivalent)', approxRows: 1, notes: 'Detailed sheet: see Plan 02. NEEDS DECISION.' },
    // Chat Domain (detailed sheet in Plan 02)
    { oldTable: 'chats', status: 'MAPPED', newTables: 'conversations + messages', approxRows: 286, notes: 'Detailed sheet: see Plan 02. COMPLEX: flat -> grouped conversations.' },
    // Notes Domain (detailed sheet in Plan 02)
    { oldTable: 'notes', status: 'NEEDS DECISION', newTables: '(no direct equivalent)', approxRows: 7, notes: 'Detailed sheet: see Plan 02. NEEDS DECISION: personal journal notes.' },
    // Notifications Domain (detailed sheet in Plan 02)
    { oldTable: 'notifications', status: 'MAPPED', newTables: 'notifications', approxRows: 28480, notes: 'Detailed sheet: see Plan 02. COMPLEX: wide table with polymorphic refs.' },
    // Video Domain (detailed sheets in Plan 02)
    { oldTable: 'uservideos', status: 'MAPPED', newTables: 'videos', approxRows: 4, notes: 'Detailed sheet: see Plan 02' },
    { oldTable: 'uservideorelations', status: 'MAPPED', newTables: 'video_progress', approxRows: 1159, notes: 'Detailed sheet: see Plan 02' },
  ];
}

// ---------------------------------------------------------------------------
// Section H: Main Execution
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== FreeLuma Migration Mapping Generator ===\n');

  // 1. Read SQL dump
  console.log(`Reading SQL dump: ${SQL_DUMP_PATH}`);
  if (!fs.existsSync(SQL_DUMP_PATH)) {
    console.error(`ERROR: SQL dump not found at ${SQL_DUMP_PATH}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(SQL_DUMP_PATH, 'utf-8');
  console.log(`  Read ${sql.length.toLocaleString()} characters (${(sql.length / 1024 / 1024).toFixed(1)} MB)\n`);

  // 2. Parse all CREATE TABLE statements
  console.log('Parsing CREATE TABLE statements...');
  const tableSchemas = parseCreateTables(sql);
  console.log(`  Found ${tableSchemas.size} tables\n`);

  // 3. Create workbook
  const workbook = createWorkbook();

  // 4. Create Overview sheet
  console.log('Creating Overview sheet...');
  createOverviewSheet(workbook, tableSchemas, sql);

  // 5. Create table sheets for each configured mapping
  const mappedTables = Object.keys(TABLE_MAPPINGS);
  let sheetsCreated = 0;

  for (const tableName of mappedTables) {
    const config = TABLE_MAPPINGS[tableName];
    const schema = tableSchemas.get(tableName);
    const columnNames = schema ? schema.map(c => c.name) : [];

    console.log(`Processing: ${tableName}...`);

    // Extract sample rows
    const sampleRows = extractSampleRows(sql, tableName, columnNames, 5);
    const rowCount = countTableRows(sql, tableName);
    const autoInc = getAutoIncrement(sql, tableName);

    console.log(`  Columns: ${columnNames.length}, Sample rows: ${sampleRows.length}, Total rows: ${rowCount}${autoInc ? ` (AUTO_INCREMENT: ${autoInc})` : ''}`);

    // Create sheet
    createTableSheet(workbook, tableName, config, sampleRows, columnNames);
    sheetsCreated++;
  }

  // 6. Write Excel file
  console.log(`\nWriting ${OUTPUT_PATH}...`);
  await workbook.xlsx.writeFile(OUTPUT_PATH);

  const stats = fs.statSync(OUTPUT_PATH);
  console.log(`  File size: ${(stats.size / 1024).toFixed(1)} KB`);

  // 7. Summary
  console.log('\n=== Summary ===');
  console.log(`  Overview sheet: All ${ALL_TABLES.length} non-workshop tables + ${EXCLUDED_TABLES.length} excluded`);
  console.log(`  Detailed table sheets: ${sheetsCreated} created`);
  console.log(`    Users domain: users, settings, subscribewebpushes`);
  console.log(`    Categories domain: categories, category_user_relations, homescreen_tile_categories`);
  console.log(`    Social domain: posts, comments, usercomments, follows`);
  console.log(`  Remaining for Plan 02: ${ALL_TABLES.length - sheetsCreated} tables`);
  console.log(`    Daily Content: dailyposts, dailypostcomments, dailypostusercomments, dailypostusers, dailychapters`);
  console.log(`    Verse: verses, verse_comments, verse_likes, verse_user_comments`);
  console.log(`    Chat: chats`);
  console.log(`    Notes: notes`);
  console.log(`    Notifications: notifications`);
  console.log(`    Video: uservideos, uservideorelations`);
  console.log(`\n  Output: ${OUTPUT_PATH}`);
  console.log('  Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
