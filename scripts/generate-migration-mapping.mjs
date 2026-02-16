/**
 * Migration Mapping Spreadsheet Generator
 *
 * Parses the old FreeLuma SQL dump and generates an Excel spreadsheet
 * documenting how old data should be IMPORTED into the existing new schema.
 *
 * IMPORTANT: This is a one-way import guide. The new database already exists
 * with its own tables and data. We are NOT dropping or creating tables —
 * only documenting which old data maps to which existing new tables.
 *
 * Usage: node scripts/generate-migration-mapping.mjs
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

// Tables already migrated separately — skip entirely (content only, not interactions)
const ALREADY_MIGRATED_TABLES = [
  'dailyposts',
  'dailychapters',
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
    name: 'Daily Content Interactions',
    tables: ['dailypostcomments', 'dailypostusers', 'dailypostusercomments'],
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
  lightPurple: 'FFE8D5F5',
  lightOrange: 'FFFCE4D6',
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
// Section B2: Orphan Detection
// ---------------------------------------------------------------------------

/**
 * Extract all values of a specific column from INSERT statements.
 * Returns a Set of values (as strings).
 * For efficiency, uses a targeted parse that only extracts the column at the given index.
 */
function extractColumnValueSet(sql, tableName, columnIndex) {
  const values = new Set();
  const inserts = findInsertStatements(sql, tableName);

  for (const { valuesBlock } of inserts) {
    const tuples = extractTuples(valuesBlock);
    for (const tuple of tuples) {
      const parsed = parseTupleValues(tuple);
      if (columnIndex < parsed.length) {
        const val = parsed[columnIndex];
        if (val !== null && val !== undefined && val !== '') {
          values.add(String(val));
        }
      }
    }
  }

  return values;
}

/**
 * Get the column index for a given column name in a table's INSERT statements.
 * Returns -1 if not found.
 */
function getColumnIndex(sql, tableName, columnName) {
  const inserts = findInsertStatements(sql, tableName);
  if (inserts.length === 0) return -1;
  const idx = inserts[0].colList.indexOf(columnName);
  return idx;
}

/**
 * Orphan check definition: which FK columns to check for each table.
 * Returns Array<{fkCol, refTable, refCol, refIdSet, note}>
 */
function getOrphanChecks(tableName) {
  const checks = {
    // Users domain -- users is the root, no FK checks needed
    users: [],
    settings: [],
    subscribewebpushes: [
      { fkCol: 'user', refTable: 'users', refCol: 'id', note: '' },
    ],
    // Categories domain
    categories: [],
    category_user_relations: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'category_id', refTable: 'categories', refCol: 'id', note: '' },
    ],
    homescreen_tile_categories: [],
    // Social domain
    posts: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'category_id', refTable: 'categories', refCol: 'id', note: '' },
    ],
    comments: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'post_id', refTable: 'posts', refCol: 'id', note: '' },
    ],
    usercomments: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'comment_id', refTable: 'comments', refCol: 'id', note: '' },
    ],
    follows: [
      { fkCol: 'follower_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'following_id', refTable: 'users', refCol: 'id', note: '' },
    ],
    // Daily Content Interactions
    dailypostcomments: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'daily_post_id', refTable: 'dailyposts', refCol: 'id', note: '' },
    ],
    dailypostusers: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'daily_post_id', refTable: 'dailyposts', refCol: 'id', note: '' },
    ],
    dailypostusercomments: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'comment_id', refTable: 'dailypostcomments', refCol: 'id', note: '' },
    ],
    // Verse domain
    verses: [],
    verse_comments: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'verse_id', refTable: 'verses', refCol: 'id', note: '' },
    ],
    verse_likes: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'verse_name', refTable: 'verses', refCol: 'verse_name', note: 'String match, not ID match. Fragile join.' },
    ],
    verse_user_comments: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'comment_id', refTable: 'verse_comments', refCol: 'id', note: '' },
    ],
    // Chat domain
    chats: [
      { fkCol: 'sender_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'receiver_id', refTable: 'users', refCol: 'id', note: '' },
    ],
    // Notes domain
    notes: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
    ],
    // Notifications domain
    notifications: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'action_done_by', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'post_id', refTable: 'posts', refCol: 'id', note: 'Uses 0 for no-post. Only check non-zero values.' },
      { fkCol: 'comment_id', refTable: 'comments', refCol: 'id', note: 'Nullable' },
      // daily_post_comment_id orphan check removed — daily content already migrated
    ],
    // Video domain
    uservideos: [],
    uservideorelations: [
      { fkCol: 'user_id', refTable: 'users', refCol: 'id', note: '' },
      { fkCol: 'uservideo_id', refTable: 'uservideos', refCol: 'id', note: '' },
    ],
  };

  return checks[tableName] || [];
}

/**
 * Run orphan detection across all tables.
 * Returns Map<tableName, Array<{fkCol, refTable, orphanCount, sampleOrphanIds, note}>>
 *
 * Strategy: Build reference ID sets once, then check each child table's FK values.
 */
function detectOrphans(sql) {
  console.log('\n--- Orphan Detection ---');

  // Build reference ID sets for parent tables
  // Key = "tableName.colName", Value = Set<string>
  const idSets = new Map();

  const refTablesToLoad = [
    { table: 'users', col: 'id' },
    { table: 'categories', col: 'id' },
    { table: 'posts', col: 'id' },
    { table: 'comments', col: 'id' },
    { table: 'dailyposts', col: 'id' },
    { table: 'dailypostcomments', col: 'id' },
    { table: 'verses', col: 'id' },
    { table: 'verses', col: 'verse_name' },
    { table: 'verse_comments', col: 'id' },
    { table: 'uservideos', col: 'id' },
  ];

  for (const { table, col } of refTablesToLoad) {
    const key = `${table}.${col}`;
    console.log(`  Loading reference IDs: ${key}...`);
    const colIdx = getColumnIndex(sql, table, col);
    if (colIdx === -1) {
      console.log(`    WARNING: column ${col} not found in ${table} INSERT statements`);
      idSets.set(key, new Set());
      continue;
    }
    const idSet = extractColumnValueSet(sql, table, colIdx);
    idSets.set(key, idSet);
    console.log(`    Loaded ${idSet.size} values`);
  }

  // Run orphan checks for each table
  const results = new Map();
  let tablesWithOrphans = 0;

  for (const tableName of ALL_TABLES) {
    const checks = getOrphanChecks(tableName);
    const tableResults = [];

    for (const check of checks) {
      const refKey = `${check.refTable}.${check.refCol}`;
      const refSet = idSets.get(refKey);
      if (!refSet) {
        tableResults.push({
          fkCol: check.fkCol,
          refTable: `${check.refTable}.${check.refCol}`,
          orphanCount: -1,
          sampleOrphanIds: [],
          note: 'Reference table not loaded',
        });
        continue;
      }

      // Get FK column index
      const fkIdx = getColumnIndex(sql, tableName, check.fkCol);
      if (fkIdx === -1) {
        tableResults.push({
          fkCol: check.fkCol,
          refTable: `${check.refTable}.${check.refCol}`,
          orphanCount: -1,
          sampleOrphanIds: [],
          note: `Column ${check.fkCol} not found in ${tableName}`,
        });
        continue;
      }

      // Extract FK values and check against reference set
      const fkValues = extractColumnValueSet(sql, tableName, fkIdx);
      const orphans = [];
      for (const val of fkValues) {
        // Skip 0 and NULL (not real references)
        if (val === '0' || val === 'NULL' || val === '') continue;
        if (!refSet.has(val)) {
          orphans.push(val);
        }
      }

      const sampleIds = orphans.slice(0, 5);
      tableResults.push({
        fkCol: check.fkCol,
        refTable: `${check.refTable}.${check.refCol}`,
        orphanCount: orphans.length,
        sampleOrphanIds: sampleIds,
        note: check.note || (orphans.length === 0 ? 'Clean' : `${orphans.length} distinct orphan values found`),
      });
    }

    results.set(tableName, tableResults);
    const hasOrphans = tableResults.some(r => r.orphanCount > 0);
    if (hasOrphans) tablesWithOrphans++;

    if (checks.length > 0) {
      const orphanSummary = tableResults
        .filter(r => r.orphanCount > 0)
        .map(r => `${r.fkCol}: ${r.orphanCount} orphans`)
        .join(', ');
      console.log(`  ${tableName}: ${orphanSummary || 'No orphans'}`);
    }
  }

  console.log(`\n  Tables with orphans: ${tablesWithOrphans}`);
  return results;
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
    } else if (entry.status === 'EXCLUDED' || entry.status === 'SKIP') {
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
    } else if (entry.status === 'ALREADY MIGRATED') {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.lightPurple },
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
function createTableSheet(workbook, tableName, config, sampleData, columnNames, orphanResults = []) {
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

  // Orphan detection section
  {
    const orphanHeaderRow = sheet.addRow(['ORPHAN DETECTION']);
    sheet.mergeCells(`A${orphanHeaderRow.number}:I${orphanHeaderRow.number}`);
    applySectionHeaderStyle(orphanHeaderRow, COLORS.lightOrange);

    if (orphanResults.length === 0) {
      sheet.addRow(['No foreign key checks applicable for this table']);
    } else {
      const orphanColHeaders = sheet.addRow([
        'FK Column', 'References', 'Orphan Count', 'Sample Orphan IDs', 'Notes',
      ]);
      applyHeaderStyle(orphanColHeaders, COLORS.lightBlue, 'FF000000');

      for (const result of orphanResults) {
        const row = sheet.addRow([
          result.fkCol,
          result.refTable,
          result.orphanCount === -1 ? 'N/A' : result.orphanCount,
          result.sampleOrphanIds.length > 0 ? result.sampleOrphanIds.join(', ') : '--',
          result.note,
        ]);

        // Highlight rows with orphans
        if (result.orphanCount > 0) {
          row.getCell(3).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.lightYellow },
          };
          row.getCell(3).font = { bold: true };
        }
      }
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
    { oldCol: 'username', oldType: 'varchar(255)', newTable: 'users', newCol: 'username', newType: 'VARCHAR(30)', transform: 'direct copy. For IDs <= ~85 (test accounts like test1234, shady123): import but set status=deactivated', quality: 'First ~85 IDs are test accounts' },
    { oldCol: 'email', oldType: 'varchar(255)', newTable: 'users', newCol: 'email', newType: 'VARCHAR(255)', transform: 'direct copy', quality: 'Unique constraint' },
    { oldCol: 'password', oldType: 'varchar(255)', newTable: 'users', newCol: 'password_hash', newType: 'VARCHAR(255)', transform: 'If starts with $2y$: replace prefix with $2b$ (identical algorithm, seamless). If plaintext: hash with bcrypt during import. All users log in with existing passwords unchanged.', quality: 'At least 1 plaintext password (user_id=6). Most are $2y$10$ format.' },
    { oldCol: 'profile_picture', oldType: 'varchar(255)', newTable: 'users', newCol: 'avatar_url', newType: 'VARCHAR(500)', transform: 'prefix with B2 storage URL path (MIG-08); handle "default.jpg" as NULL', quality: 'Mix of filenames: default.jpg, username.jpg, username.png' },
    { oldCol: 'city', oldType: 'varchar(255)', newTable: 'users', newCol: 'location', newType: 'VARCHAR(100)', transform: 'merge: city + ", " + state + ", " + country (filter empties)', quality: '' },
    { oldCol: 'state', oldType: 'varchar(255)', newTable: 'users', newCol: '(merged into location)', newType: '--', transform: 'merge with city and country (see above)', quality: '' },
    { oldCol: 'followings_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from follows table) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'posts_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from posts table) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'users', newCol: 'created_at', newType: 'DATE', transform: 'direct copy (preserve original registration date)', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'users', newCol: 'updated_at', newType: 'DATE', transform: 'direct copy', quality: '' },
    { oldCol: 'liked_posts', oldType: 'longtext (JSON)', newTable: 'post_reactions', newCol: 'post_id + user_id + reaction_type', newType: 'See post_reactions model', transform: 'Parse JSON array of post IDs (e.g. ["396","395"]) -> create post_reactions row per ID with reaction_type="love". Only 3 users have data (157 total likes, mix of FEED and PRAYER_WALL). 0 orphans — all IDs valid.', quality: '' },
    { oldCol: 'dob', oldType: 'date', newTable: 'users', newCol: 'date_of_birth', newType: 'DATEONLY', transform: 'rename; convert 0000-00-00 to NULL', quality: 'MEDIUM: Contains 0000-00-00 invalid dates for many users' },
    { oldCol: 'phone', oldType: 'varchar(255)', newTable: 'users', newCol: 'phone', newType: 'VARCHAR(20)', transform: 'direct copy; ADD COLUMN to new schema (new migration needed). Import existing values, NULL for users without phone.', quality: 'Some users have phone numbers stored' },
    { oldCol: 'followers_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from follows table) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'bookmark_setting', oldType: "varchar(255) DEFAULT 'FLP'", newTable: '--', newCol: '--', newType: '--', transform: 'DROP — bible_setting used instead for preferred_translation', quality: '' },
    { oldCol: 'bible_setting', oldType: "varchar(255) DEFAULT 'FLP'", newTable: 'users', newCol: 'preferred_translation', newType: 'VARCHAR(10)', transform: 'rename: bible_setting -> preferred_translation (values: KJV, NIV, NIRV, FLP, etc.)', quality: '' },
    { oldCol: 'notification_preference', oldType: 'longtext (JSON)', newTable: 'user_settings', newCol: 'multiple columns', newType: 'See user_settings model', transform: 'parse JSON -> split into email_dm, email_follow, email_prayer, email_daily_reminder boolean settings', quality: '' },
    { oldCol: 'account_visibility', oldType: "enum('PUBLIC','PRIVATE')", newTable: 'users', newCol: 'profile_privacy', newType: "ENUM('public','private')", transform: 'lowercase: PUBLIC->public, PRIVATE->private', quality: '' },
    { oldCol: 'daily_post_notification_time', oldType: 'time', newTable: 'user_settings', newCol: 'daily_reminder_time', newType: 'STRING', transform: 'move to user_settings table; convert TIME to string HH:MM', quality: '' },
    { oldCol: 'tile_category', oldType: 'varchar(255)', newTable: '--', newCol: '--', newType: '--', transform: 'DROP — old homescreen layout, not needed', quality: '' },
    { oldCol: 'top_slide_preference', oldType: 'varchar(255)', newTable: '--', newCol: '--', newType: '--', transform: 'DROP — old UI preference, not needed', quality: '' },
    { oldCol: 'comment_hidden', oldType: 'tinyint(1) NOT NULL DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'DROP — not needed in new schema', quality: '' },
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
  status: 'SKIP',
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
  status: 'SKIP',
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
  status: 'SKIP',
  newTables: ['(no equivalent in new schema)'],
  notes: 'SKIP: 10 category entries for homescreen tiles. No equivalent in new schema — old homescreen layout not carried over.',
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
    { oldCol: 'cover_media', oldType: 'int(11)', newTable: '--', newCol: '--', newType: '--', transform: 'DROP — index into media array for display ordering, not needed in new schema', quality: '' },
    { oldCol: 'likes_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from post_reactions) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'comments_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema (COUNT from post_comments) -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'shares_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED in new schema -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'is_updated', oldType: 'tinyint(1) DEFAULT 0', newTable: 'posts', newCol: 'edited', newType: 'BOOLEAN', transform: 'rename: is_updated -> edited', quality: '' },
    { oldCol: 'is_deleted', oldType: 'tinyint(1) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'FILTER: skip rows where is_deleted=1 (do not import deleted posts)', quality: '' },
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
    { oldCol: 'is_deleted', oldType: 'tinyint(1) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'FILTER: skip rows where is_deleted=1 (do not import deleted comments)', quality: '' },
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
// Section G: Mapping Configuration -- Daily Content Domain
// ---------------------------------------------------------------------------

// dailyposts and dailychapters: ALREADY MIGRATED (content + listen logs)
// The 3 interaction tables below still need importing:

const DAILYPOSTCOMMENTS_MAPPING = {
  oldTable: 'dailypostcomments',
  status: 'MAPPED',
  newTables: ['daily_comments'],
  notes: 'Comments on daily content. 872 rows. Hierarchical (parent_id for replies). Map daily_post_id to daily_content_id via dailyposts.daily_post_name -> daily_content.post_date date lookup.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'daily_comments', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'daily_post_id', oldType: 'int(11) NOT NULL', newTable: 'daily_comments', newCol: 'daily_content_id', newType: 'INTEGER', transform: 'LOOKUP: old dailyposts.id -> dailyposts.daily_post_name (date string) -> match daily_content.post_date -> daily_content.id', quality: 'Requires cross-table ID resolution' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: 'daily_comments', newCol: 'user_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'parent_id', oldType: 'int(11) NOT NULL DEFAULT 0', newTable: 'daily_comments', newCol: 'parent_id', newType: 'INTEGER NULL', transform: 'Convert: 0 -> NULL (root comment), non-zero -> direct copy (reply)', quality: 'Old uses 0 for root, new uses NULL' },
    { oldCol: 'text_content', oldType: 'text', newTable: 'daily_comments', newCol: 'body', newType: 'TEXT', transform: 'rename: text_content -> body', quality: '' },
    { oldCol: 'likes_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'DROP — computed dynamically in new schema', quality: 'Denormalized counter' },
    { oldCol: 'reply_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'DROP — computed dynamically in new schema', quality: 'Denormalized counter' },
    { oldCol: 'is_deleted', oldType: 'tinyint(1) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'FILTER: skip rows where is_deleted=1 (do not import deleted comments)', quality: 'Soft delete flag — hard delete in new schema' },
    { oldCol: 'category_id', oldType: 'int(11) DEFAULT NULL', newTable: '--', newCol: '--', newType: '--', transform: 'DROP — always 1, not used in new schema', quality: 'Always 1 in data' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'daily_comments', newCol: 'created_at', newType: 'DATE', transform: 'rename: camelCase -> snake_case', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'daily_comments', newCol: 'updated_at', newType: 'DATE', transform: 'rename: camelCase -> snake_case', quality: '' },
    // New schema columns not in old
    { oldCol: '(new)', oldType: '--', newTable: 'daily_comments', newCol: 'edited', newType: 'BOOLEAN', transform: 'default false', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'dailypostcomments.daily_post_id', to: 'dailyposts.id', desc: 'Belongs to daily post', newEquiv: 'daily_comments.daily_content_id -> daily_content.id' },
    { type: 'N:1', from: 'dailypostcomments.user_id', to: 'users.id', desc: 'Comment author', newEquiv: 'daily_comments.user_id -> users.id' },
    { type: 'N:1', from: 'dailypostcomments.parent_id', to: 'dailypostcomments.id', desc: 'Reply to comment', newEquiv: 'daily_comments.parent_id -> daily_comments.id' },
    { type: '1:N', from: 'dailypostcomments.id', to: 'dailypostusercomments.comment_id', desc: 'Comment likes', newEquiv: '(see dailypostusercomments mapping)' },
  ],
};

const DAILYPOSTUSERS_MAPPING = {
  oldTable: 'dailypostusers',
  status: 'MAPPED',
  newTables: ['daily_reactions', 'bookmarks'],
  notes: 'DUAL SPLIT: User interactions with daily posts. 2,925 rows. Each row has is_liked + is_bookmarked flags. Splits into daily_reactions (likes as love/heart) and bookmarks. A single old row can produce BOTH a reaction AND a bookmark.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: '--', newCol: '--', newType: '--', transform: 'DROP — new IDs auto-generated for each split target', quality: '' },
    { oldCol: 'daily_post_id', oldType: 'int(11) NOT NULL', newTable: 'daily_reactions / bookmarks', newCol: 'daily_content_id', newType: 'INTEGER', transform: 'LOOKUP: old dailyposts.id -> dailyposts.daily_post_name -> match daily_content.post_date -> daily_content.id', quality: 'Requires cross-table ID resolution' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: 'daily_reactions / bookmarks', newCol: 'user_id', newType: 'INTEGER', transform: 'direct copy to whichever target row(s) are generated', quality: '' },
    { oldCol: 'is_liked', oldType: 'tinyint(1) DEFAULT 0', newTable: 'daily_reactions', newCol: 'reaction_type', newType: "ENUM('like','love','haha','wow','sad','pray')", transform: "WHERE is_liked=1: create daily_reactions row with reaction_type='love' (heart). Skip if is_liked=0.", quality: '' },
    { oldCol: 'is_bookmarked', oldType: 'tinyint(1) DEFAULT 0', newTable: 'bookmarks', newCol: 'daily_content_id', newType: 'INTEGER', transform: 'WHERE is_bookmarked=1: create bookmarks row with daily_content_id + user_id. Skip if is_bookmarked=0.', quality: '' },
    { oldCol: 'category_id', oldType: 'int(11) DEFAULT NULL', newTable: '--', newCol: '--', newType: '--', transform: 'DROP — always 1, not used in new schema', quality: 'Always 1 in data' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'daily_reactions / bookmarks', newCol: 'created_at', newType: 'DATE', transform: 'rename: camelCase -> snake_case. Copy to whichever target row(s).', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'daily_reactions / bookmarks', newCol: 'updated_at', newType: 'DATE', transform: 'rename: camelCase -> snake_case', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'dailypostusers.daily_post_id', to: 'dailyposts.id', desc: 'Belongs to daily post', newEquiv: 'daily_reactions.daily_content_id / bookmarks.daily_content_id -> daily_content.id' },
    { type: 'N:1', from: 'dailypostusers.user_id', to: 'users.id', desc: 'Interacting user', newEquiv: 'daily_reactions.user_id / bookmarks.user_id -> users.id' },
  ],
};

const DAILYPOSTUSERCOMMENTS_MAPPING = {
  oldTable: 'dailypostusercomments',
  status: 'MAPPED',
  newTables: ['daily_comment_reactions'],
  notes: 'Likes on daily comments. 6,733 rows. Maps to NEW daily_comment_reactions table (needs migration). Only import rows where is_liked=1. Heart-only reactions (no reaction_type enum needed).',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'daily_comment_reactions', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'comment_id', oldType: 'int(11) NOT NULL', newTable: 'daily_comment_reactions', newCol: 'comment_id', newType: 'INTEGER', transform: 'rename: comment_id -> comment_id (FK to daily_comments.id). IDs should match since dailypostcomments.id maps 1:1 to daily_comments.id.', quality: '' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: 'daily_comment_reactions', newCol: 'user_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'is_liked', oldType: 'tinyint(1) DEFAULT 0', newTable: 'daily_comment_reactions', newCol: '(n/a — heart only)', newType: 'no reaction_type column needed', transform: "FILTER: only import rows where is_liked=1. Table only supports heart reactions — no reaction_type enum. Skip is_liked=0 rows.", quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'daily_comment_reactions', newCol: 'created_at', newType: 'DATE', transform: 'rename: camelCase -> snake_case', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'daily_comment_reactions', newCol: 'updated_at', newType: 'DATE', transform: 'rename: camelCase -> snake_case', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'dailypostusercomments.comment_id', to: 'dailypostcomments.id', desc: 'The comment being liked', newEquiv: 'daily_comment_reactions.comment_id -> daily_comments.id' },
    { type: 'N:1', from: 'dailypostusercomments.user_id', to: 'users.id', desc: 'User who liked', newEquiv: 'daily_comment_reactions.user_id -> users.id' },
  ],
};

// ---------------------------------------------------------------------------
// Section H: Mapping Configuration -- Verse Domain
// ---------------------------------------------------------------------------

const VERSES_MAPPING = {
  oldTable: 'verses',
  status: 'SKIP',
  newTables: ['(no equivalent in new schema)'],
  notes: 'SKIP: 3,409 verses. Verse content handled by daily_content.verse_reference in new schema. No standalone verse table needed.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'verse_name', oldType: 'varchar(255) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: verse_name is the verse reference string (e.g. "John 3:16"). Used as join key by verse_likes.', quality: 'Used as string FK by verse_likes (fragile join)' },
    { oldCol: 'likes_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'comments_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
  ],
  relationships: [
    { type: '1:N', from: 'verses.id', to: 'verse_comments.verse_id', desc: 'Verse comments (by ID)', newEquiv: '(NEEDS DECISION)' },
    { type: '1:N (string)', from: 'verses.verse_name', to: 'verse_likes.verse_name', desc: 'Verse likes (by NAME string, not ID!)', newEquiv: '(NEEDS DECISION)' },
  ],
};

const VERSE_COMMENTS_MAPPING = {
  oldTable: 'verse_comments',
  status: 'SKIP',
  newTables: ['(no equivalent in new schema)'],
  notes: 'SKIP: 42 comments on verses. Only 42 rows — superseded by daily_comments in new schema.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'verse_id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: FK to verses.id', quality: '' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'parent_id', oldType: 'int(11) NOT NULL DEFAULT 0', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION. parent_id=0 means root comment (same pattern as dailypostcomments).', quality: 'Uses 0 instead of NULL for root' },
    { oldCol: 'text_content', oldType: 'text', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'likes_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'reply_count', oldType: 'int(11) DEFAULT 0', newTable: '--', newCol: '--', newType: '--', transform: 'COMPUTED -- no migration needed', quality: 'Denormalized counter' },
    { oldCol: 'is_deleted', oldType: 'tinyint(1) DEFAULT 0', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'verse_comments.verse_id', to: 'verses.id', desc: 'Belongs to verse', newEquiv: '(NEEDS DECISION)' },
    { type: 'N:1', from: 'verse_comments.user_id', to: 'users.id', desc: 'Comment author', newEquiv: '(NEEDS DECISION)' },
    { type: 'Self 1:N', from: 'verse_comments.parent_id', to: 'verse_comments.id', desc: 'Reply threading', newEquiv: '(NEEDS DECISION)' },
    { type: '1:N', from: 'verse_comments.id', to: 'verse_user_comments.comment_id', desc: 'Comment reactions', newEquiv: '(NEEDS DECISION)' },
  ],
};

const VERSE_LIKES_MAPPING = {
  oldTable: 'verse_likes',
  status: 'SKIP',
  newTables: ['(no equivalent in new schema)'],
  notes: 'SKIP: 3,716 likes on verses. Verse interactions superseded by daily_reactions. References verses by name string (not ID).',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'verse_name', oldType: 'varchar(255) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: joined by name string to verses.verse_name. NOT a proper FK!', quality: 'HIGH: fragile string join. Some values may be empty.' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'is_liked', oldType: 'tinyint(1) DEFAULT 0', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: binary flag, only rows with is_liked=1 represent actual likes', quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
  ],
  relationships: [
    { type: 'N:1 (string)', from: 'verse_likes.verse_name', to: 'verses.verse_name', desc: 'Like on verse (by NAME, not ID!)', newEquiv: '(NEEDS DECISION)' },
    { type: 'N:1', from: 'verse_likes.user_id', to: 'users.id', desc: 'Like by user', newEquiv: '(NEEDS DECISION)' },
  ],
};

const VERSE_USER_COMMENTS_MAPPING = {
  oldTable: 'verse_user_comments',
  status: 'SKIP',
  newTables: ['(no equivalent in new schema)'],
  notes: 'SKIP: Only 1 row. Verse comment reactions — not needed in new schema.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'comment_id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: FK to verse_comments.id', quality: '' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'is_liked', oldType: 'tinyint(1) DEFAULT 0', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: binary flag', quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'verse_user_comments.comment_id', to: 'verse_comments.id', desc: 'Reaction on verse comment', newEquiv: '(NEEDS DECISION)' },
    { type: 'N:1', from: 'verse_user_comments.user_id', to: 'users.id', desc: 'Reaction by user', newEquiv: '(NEEDS DECISION)' },
  ],
};

// ---------------------------------------------------------------------------
// Section I: Mapping Configuration -- Chat Domain
// ---------------------------------------------------------------------------

const CHATS_MAPPING = {
  oldTable: 'chats',
  status: 'MAPPED',
  newTables: ['conversations', 'conversation_participants', 'messages'],
  notes: 'COMPLEX STRUCTURAL transformation. Flat chat table -> grouped conversations model. ~286 rows. Group by unique (min(sender,receiver), max(sender,receiver)) pairs. Each pair = 1 conversation + 2 participants. Each old row = 1 message. Has message_type and media columns for non-text messages.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'messages', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy (preserve as message ID)', quality: '' },
    { oldCol: 'sender_id', oldType: 'int(11) NOT NULL', newTable: 'messages', newCol: 'sender_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'receiver_id', oldType: 'int(11) NOT NULL', newTable: 'conversations (derived)', newCol: '(used for conversation grouping)', newType: '--', transform: 'Step 1: normalize (sender_id, receiver_id) -> (min, max) to find unique conversation pairs. Step 2: create conversation row per unique pair.', quality: '' },
    { oldCol: 'message', oldType: 'text NOT NULL', newTable: 'messages', newCol: 'body', newType: 'TEXT', transform: 'rename: message -> body', quality: 'Unicode escape sequences in some messages (e.g., U+2764 U+FE0F)' },
    { oldCol: 'message_type', oldType: "enum('TEXT','IMAGE','VIDEO','AUDIO') DEFAULT 'TEXT'", newTable: 'messages', newCol: 'type', newType: "ENUM('text','image','video','audio','file')", transform: "Map: TEXT->'text', IMAGE->'image', VIDEO->'video', AUDIO->'audio'", quality: '' },
    { oldCol: 'media', oldType: 'varchar(255) DEFAULT NULL', newTable: 'messages', newCol: 'media_url', newType: 'VARCHAR(500)', transform: 'rename: media -> media_url. Prefix with B2 storage URL for non-NULL values.', quality: 'NULL for TEXT messages, filename for media messages' },
    { oldCol: 'is_seen', oldType: 'tinyint(1) DEFAULT 0', newTable: 'messages', newCol: 'read_at', newType: 'DATE (nullable)', transform: "is_seen=1 -> read_at = updatedAt timestamp; is_seen=0 -> read_at = NULL", quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'messages', newCol: 'created_at', newType: 'DATE', transform: 'rename. Also: earliest createdAt per conversation pair -> conversations.created_at', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'messages', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
    // New schema: conversations table derived from grouping
    { oldCol: '(derived)', oldType: '--', newTable: 'conversations', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'Generate 1 row per unique (min(sender,receiver), max(sender,receiver)) pair', quality: '' },
    { oldCol: '(derived)', oldType: '--', newTable: 'conversations', newCol: 'type', newType: "ENUM('direct','group')", transform: "Always 'direct' for migrated chats", quality: '' },
    { oldCol: '(derived)', oldType: '--', newTable: 'conversations', newCol: 'created_at', newType: 'DATE', transform: 'earliest createdAt from chats in this conversation', quality: '' },
    // New schema: conversation_participants derived from grouping
    { oldCol: '(derived)', oldType: '--', newTable: 'conversation_participants', newCol: 'conversation_id + user_id', newType: 'INTEGER pair', transform: '2 rows per conversation: one for each user in the pair', quality: '' },
    // New schema: messages.conversation_id
    { oldCol: '(derived)', oldType: '--', newTable: 'messages', newCol: 'conversation_id', newType: 'INTEGER', transform: 'Assign from conversation grouping step', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'chats.sender_id', to: 'users.id', desc: 'Message sender', newEquiv: 'messages.sender_id -> users.id' },
    { type: 'N:1', from: 'chats.receiver_id', to: 'users.id', desc: 'Message receiver', newEquiv: 'conversation_participants.user_id -> users.id' },
  ],
};

// ---------------------------------------------------------------------------
// Section J: Mapping Configuration -- Notes Domain
// ---------------------------------------------------------------------------

const NOTES_MAPPING = {
  oldTable: 'notes',
  status: 'SKIP',
  newTables: ['(no equivalent in new schema)'],
  notes: 'SKIP: Only 7 personal journal/voice notes — likely test data. No personal notes table in new schema.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'title', oldType: 'varchar(255)', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: mostly "Voice Note" titles', quality: 'Generic titles like "Voice Note"' },
    { oldCol: 'content', oldType: 'text', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: NULL for audio notes, may contain HTML for text notes', quality: 'MEDIUM: HTML content needs stripping if migrated' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'note_type', oldType: "enum('TEXT','AUDIO')", newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: "NEEDS DECISION: type discriminator. Most rows are 'AUDIO'.", quality: '' },
    { oldCol: 'voice_audio', oldType: 'varchar(255)', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: audio filename (e.g. 1741842219480.mp3). Would need B2 path prefix if migrated.', quality: 'Filename only, no path prefix' },
    { oldCol: 'is_deleted', oldType: 'tinyint(1) DEFAULT 0', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION: soft delete flag', quality: 'Some notes already deleted' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: '(TBD)', newCol: '(TBD)', newType: '(TBD)', transform: 'NEEDS DECISION', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'notes.user_id', to: 'users.id', desc: 'Note owner', newEquiv: '(NEEDS DECISION)' },
  ],
};

// ---------------------------------------------------------------------------
// Section K: Mapping Configuration -- Notifications Domain
// ---------------------------------------------------------------------------

const NOTIFICATIONS_MAPPING = {
  oldTable: 'notifications',
  status: 'SKIP',
  newTables: ['notifications'],
  notes: 'SKIP — start fresh. Historical notifications not worth the complex 18->9 column transformation. 28,480 rows skipped.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'notifications', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: 'notifications', newCol: 'recipient_id', newType: 'INTEGER', transform: 'rename: user_id -> recipient_id', quality: '' },
    { oldCol: 'notification_type', oldType: "enum('FOLLOW','LIKE','COMMENT','CHAT','WORKSHOP')", newTable: 'notifications', newCol: 'type', newType: "ENUM('follow','follow_request','follow_accept','reaction','comment','message','workshop_invite','workshop_update')", transform: "Map: FOLLOW -> 'follow' (check request_follow/accept_follow for variants), LIKE -> 'reaction', COMMENT -> 'comment', CHAT -> 'message', WORKSHOP -> 'workshop_invite'", quality: '' },
    { oldCol: 'action_done_by', oldType: 'int(11) NOT NULL', newTable: 'notifications', newCol: 'actor_id', newType: 'INTEGER', transform: 'rename: action_done_by -> actor_id', quality: '' },
    { oldCol: 'is_seen', oldType: 'tinyint(1) DEFAULT 0', newTable: 'notifications', newCol: 'is_read', newType: 'BOOLEAN', transform: 'rename: is_seen -> is_read', quality: '' },
    { oldCol: 'post_id', oldType: 'int(11) DEFAULT 0', newTable: 'notifications', newCol: 'entity_id + entity_type', newType: 'INTEGER + VARCHAR', transform: "IF post_id > 0: entity_id = post_id, entity_type = 'post'", quality: 'Uses 0 instead of NULL for no-post' },
    { oldCol: 'comment_id', oldType: 'int(11) DEFAULT NULL', newTable: 'notifications', newCol: 'entity_id + entity_type', newType: 'INTEGER + VARCHAR', transform: "IF comment_id IS NOT NULL AND comment_id > 0: entity_id = comment_id, entity_type = 'comment' (overrides post_id)", quality: '' },
    { oldCol: 'daily_post_comment_id', oldType: 'int(11) DEFAULT NULL', newTable: 'notifications', newCol: 'entity_id + entity_type', newType: 'INTEGER + VARCHAR', transform: "IF daily_post_comment_id IS NOT NULL AND > 0: entity_id = daily_post_comment_id, entity_type = 'daily_comment'", quality: '' },
    { oldCol: 'chat_id', oldType: 'int(11) DEFAULT NULL', newTable: 'notifications', newCol: 'entity_id + entity_type', newType: 'INTEGER + VARCHAR', transform: "IF chat_id IS NOT NULL AND > 0: entity_id = chat_id, entity_type = 'message'", quality: '' },
    { oldCol: 'workshop_id', oldType: 'int(11) DEFAULT NULL', newTable: 'notifications', newCol: 'entity_id + entity_type', newType: 'INTEGER + VARCHAR', transform: "IF workshop_id IS NOT NULL AND > 0: entity_id = workshop_id, entity_type = 'workshop'", quality: '' },
    { oldCol: 'workshop_invitation_id', oldType: 'int(11) DEFAULT NULL', newTable: 'notifications', newCol: 'entity_id + entity_type', newType: 'INTEGER + VARCHAR', transform: "IF workshop_invitation_id IS NOT NULL AND > 0: entity_id = workshop_invitation_id, entity_type = 'workshop_invite'", quality: '' },
    { oldCol: 'like_type', oldType: "enum('FEED_POST_LIKE','PRAYER_WALL_POST_LIKE','FEED_COMMENT_LIKE','PRAYER_WALL_COMMENT_LIKE','FEED_COMMENT_REPLY_LIKE','PRAYER_WALL_COMMENT_REPLY_LIKE','DAILY_POST_COMMENT_LIKE','DAILY_POST_COMMENT_REPLY_LIKE')", newTable: 'notifications', newCol: '(informs entity_type)', newType: '--', transform: 'Used to refine entity_type: *_POST_LIKE -> entity_type=post, *_COMMENT_LIKE -> entity_type=comment, DAILY_POST_COMMENT_* -> entity_type=daily_comment', quality: 'Provides context for what was liked' },
    { oldCol: 'comment_type', oldType: "enum('FEED_POST','PRAYER_WALL_POST','FEED_POST_REPLY','PRAYER_WALL_COMMENT_REPLY','DAILY_POST_COMMENT_REPLY')", newTable: 'notifications', newCol: '(informs entity_type)', newType: '--', transform: 'Used to refine entity_type for COMMENT notifications: FEED_POST/PRAYER_WALL_POST -> entity_type=post, *_REPLY -> entity_type=comment, DAILY_* -> entity_type=daily_comment', quality: '' },
    { oldCol: 'request_follow', oldType: 'tinyint(1) DEFAULT 0', newTable: 'notifications', newCol: 'type', newType: '--', transform: "IF request_follow=1: type becomes 'follow_request' instead of 'follow'", quality: '' },
    { oldCol: 'accept_follow', oldType: 'tinyint(1) DEFAULT 0', newTable: 'notifications', newCol: 'type', newType: '--', transform: "IF accept_follow=1: type becomes 'follow_accept' instead of 'follow'", quality: '' },
    { oldCol: 'category_id', oldType: 'int(11) DEFAULT NULL', newTable: '--', newCol: '--', newType: '--', transform: 'NOT NEEDED: category context is redundant in new schema', quality: '' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'notifications', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'notifications', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
    // New schema columns derived from transformation
    { oldCol: '(derived)', oldType: '--', newTable: 'notifications', newCol: 'group_key', newType: 'VARCHAR(255)', transform: "Compute: type + ':' + entity_type + ':' + entity_id (e.g., 'reaction:post:123'). Used for notification grouping.", quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'notifications.user_id', to: 'users.id', desc: 'Notification recipient', newEquiv: 'notifications.recipient_id -> users.id' },
    { type: 'N:1', from: 'notifications.action_done_by', to: 'users.id', desc: 'Notification actor', newEquiv: 'notifications.actor_id -> users.id' },
    { type: 'N:1 (polymorphic)', from: 'notifications.post_id', to: 'posts.id', desc: 'Referenced post (if applicable)', newEquiv: "notifications.entity_id -> posts.id WHERE entity_type='post'" },
    { type: 'N:1 (polymorphic)', from: 'notifications.comment_id', to: 'comments.id', desc: 'Referenced comment (if applicable)', newEquiv: "notifications.entity_id -> post_comments.id WHERE entity_type='comment'" },
    { type: 'N:1 (polymorphic)', from: 'notifications.daily_post_comment_id', to: 'dailypostcomments.id', desc: 'Referenced daily comment (if applicable)', newEquiv: "notifications.entity_id -> daily_comments.id WHERE entity_type='daily_comment'" },
    { type: 'N:1 (polymorphic)', from: 'notifications.chat_id', to: 'chats.id', desc: 'Referenced chat message (if applicable)', newEquiv: "notifications.entity_id -> messages.id WHERE entity_type='message'" },
  ],
};

// ---------------------------------------------------------------------------
// Section L: Mapping Configuration -- Video Domain
// ---------------------------------------------------------------------------

const USERVIDEOS_MAPPING = {
  oldTable: 'uservideos',
  status: 'ALREADY MIGRATED',
  newTables: ['videos'],
  notes: 'Daily video posts indexed by date. Only 4 videos. Simple rename mapping.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'videos', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'video_date', oldType: 'varchar(255)', newTable: 'videos', newCol: 'video_date', newType: 'DATEONLY', transform: "rename and convert string '2025-12-23' to DATE type", quality: 'Date string like 2025-12-23' },
    { oldCol: 'duration', oldType: 'int(11) NOT NULL', newTable: 'videos', newCol: 'duration', newType: 'INTEGER', transform: 'direct copy (seconds)', quality: 'Integer seconds' },
    { oldCol: 'thumbnail_name', oldType: 'varchar(255)', newTable: 'videos', newCol: 'thumbnail_url', newType: 'VARCHAR(500)', transform: 'rename + prefix with B2 storage URL path (e.g., "thumb_2025-12-23.jpg" -> full URL)', quality: 'Filename only, needs path prefix' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'videos', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'videos', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'deleted', oldType: 'tinyint(1) DEFAULT 0', newTable: 'videos', newCol: 'deleted_at', newType: 'DATE (paranoid)', transform: 'Convert: deleted=1 -> deleted_at=updatedAt; deleted=0 -> NULL', quality: '' },
    // New schema columns
    { oldCol: '(new)', oldType: '--', newTable: 'videos', newCol: 'video_url', newType: 'VARCHAR(500)', transform: 'NEEDS DECISION: old schema has no video_url -- video files stored in B2 keyed by video_date. Construct URL from video_date.', quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'videos', newCol: 'title', newType: 'VARCHAR(255)', transform: 'default NULL or generate from video_date', quality: '' },
    { oldCol: '(new)', oldType: '--', newTable: 'videos', newCol: 'description', newType: 'TEXT', transform: 'default NULL', quality: '' },
  ],
  relationships: [
    { type: '1:N', from: 'uservideos.id', to: 'uservideorelations.uservideo_id', desc: 'Video progress records', newEquiv: 'videos.id -> video_progress.video_id' },
  ],
};

const USERVIDEORELATIONS_MAPPING = {
  oldTable: 'uservideorelations',
  status: 'ALREADY MIGRATED',
  newTables: ['video_progress'],
  notes: 'Video viewing progress records. ~1,159 rows. Tracks listen_time (seconds) and completion status per user per video.',
  columns: [
    { oldCol: 'id', oldType: 'int(11) NOT NULL', newTable: 'video_progress', newCol: 'id', newType: 'INTEGER AUTO_INCREMENT', transform: 'direct copy', quality: '' },
    { oldCol: 'uservideo_id', oldType: 'int(11) NOT NULL', newTable: 'video_progress', newCol: 'video_id', newType: 'INTEGER', transform: 'rename: uservideo_id -> video_id', quality: '' },
    { oldCol: 'user_id', oldType: 'int(11) NOT NULL', newTable: 'video_progress', newCol: 'user_id', newType: 'INTEGER', transform: 'direct copy', quality: '' },
    { oldCol: 'listen_time', oldType: 'int(11) DEFAULT 0', newTable: 'video_progress', newCol: 'watched_seconds', newType: 'INTEGER', transform: 'rename: listen_time -> watched_seconds. Value is in seconds.', quality: 'Integer seconds listened' },
    { oldCol: 'is_completed', oldType: 'tinyint(1) DEFAULT 0', newTable: 'video_progress', newCol: 'completed', newType: 'BOOLEAN', transform: 'rename: is_completed -> completed', quality: '' },
    { oldCol: 'duration', oldType: 'int(11) NOT NULL DEFAULT 0', newTable: 'video_progress', newCol: 'duration', newType: 'INTEGER', transform: 'direct copy (video duration in seconds, duplicated from uservideos for convenience)', quality: 'Redundant with uservideos.duration' },
    { oldCol: 'createdAt', oldType: 'datetime NOT NULL', newTable: 'video_progress', newCol: 'created_at', newType: 'DATE', transform: 'rename', quality: '' },
    { oldCol: 'updatedAt', oldType: 'datetime NOT NULL', newTable: 'video_progress', newCol: 'updated_at', newType: 'DATE', transform: 'rename', quality: '' },
  ],
  relationships: [
    { type: 'N:1', from: 'uservideorelations.uservideo_id', to: 'uservideos.id', desc: 'Belongs to video', newEquiv: 'video_progress.video_id -> videos.id' },
    { type: 'N:1', from: 'uservideorelations.user_id', to: 'users.id', desc: 'Viewing user', newEquiv: 'video_progress.user_id -> users.id' },
  ],
};

// ---------------------------------------------------------------------------
// All mapping configs indexed by table name
// ---------------------------------------------------------------------------

const TABLE_MAPPINGS = {
  // Users Domain (Plan 01)
  users: USERS_MAPPING,
  settings: SETTINGS_MAPPING,
  subscribewebpushes: SUBSCRIBEWEBPUSHES_MAPPING,
  // Categories Domain (Plan 01)
  categories: CATEGORIES_MAPPING,
  category_user_relations: CATEGORY_USER_RELATIONS_MAPPING,
  homescreen_tile_categories: HOMESCREEN_TILE_CATEGORIES_MAPPING,
  // Social Domain (Plan 01)
  posts: POSTS_MAPPING,
  comments: COMMENTS_MAPPING,
  usercomments: USERCOMMENTS_MAPPING,
  follows: FOLLOWS_MAPPING,
  // Daily Content Interactions (comments, likes, bookmarks — content itself already migrated)
  dailypostcomments: DAILYPOSTCOMMENTS_MAPPING,
  dailypostusers: DAILYPOSTUSERS_MAPPING,
  dailypostusercomments: DAILYPOSTUSERCOMMENTS_MAPPING,
  // Verse Domain (Plan 02)
  verses: VERSES_MAPPING,
  verse_comments: VERSE_COMMENTS_MAPPING,
  verse_likes: VERSE_LIKES_MAPPING,
  verse_user_comments: VERSE_USER_COMMENTS_MAPPING,
  // Chat Domain (Plan 02)
  chats: CHATS_MAPPING,
  // Notes Domain (Plan 02)
  notes: NOTES_MAPPING,
  // Notifications Domain (Plan 02)
  notifications: NOTIFICATIONS_MAPPING,
  // Video Domain (Plan 02)
  uservideos: USERVIDEOS_MAPPING,
  uservideorelations: USERVIDEORELATIONS_MAPPING,
};

// ---------------------------------------------------------------------------
// Section G: Overview Data for ALL tables
// ---------------------------------------------------------------------------

function getOverviewData() {
  return [
    // Users Domain
    { oldTable: 'users', status: 'MAPPED', newTables: 'users + user_settings', approxRows: 32319, notes: 'Split: profile to users, settings to user_settings. 30+ column transformations.' },
    { oldTable: 'settings', status: 'SKIP', newTables: 'platform_settings', approxRows: 2, notes: 'Skip — old settings (UNDER_AGE_LIMIT, TILES_HIDE_FOR_GUEST) not needed in new platform.' },
    { oldTable: 'subscribewebpushes', status: 'SKIP', newTables: 'push_subscriptions', approxRows: 78, notes: 'Skip — old push subscriptions invalid on new domain/service worker.' },
    // Categories Domain
    { oldTable: 'categories', status: 'MAPPED', newTables: 'categories', approxRows: 2, notes: 'Simple 1:1 mapping. BIBLE and POSITIVITY.' },
    { oldTable: 'category_user_relations', status: 'MAPPED', newTables: 'user_categories', approxRows: 44631, notes: 'Simple rename mapping.' },
    { oldTable: 'homescreen_tile_categories', status: 'SKIP', newTables: '(no equivalent in new schema)', approxRows: 10, notes: 'No equivalent table in new schema. Old homescreen tiles not carried over.' },
    // Social Domain
    { oldTable: 'posts', status: 'MAPPED', newTables: 'posts + post_media + prayer_requests', approxRows: 42, notes: 'COMPLEX: Type split FEED/PRAYER_WALL. WARNING: Only ~42 rows in dump, AUTO_INCREMENT=1230.' },
    { oldTable: 'comments', status: 'MAPPED', newTables: 'post_comments', approxRows: 620, notes: 'Post comments with threading (parent_id).' },
    { oldTable: 'usercomments', status: 'MAPPED', newTables: 'post_comment_reactions', approxRows: 494, notes: 'Comment like/reaction pivot.' },
    { oldTable: 'follows', status: 'MAPPED', newTables: 'follows', approxRows: 1194, notes: 'Social graph follows.' },
    // Daily Content Domain
    { oldTable: 'dailyposts', status: 'ALREADY MIGRATED', newTables: 'daily_content', approxRows: 702, notes: 'Content already migrated separately. No action needed.' },
    { oldTable: 'dailypostcomments', status: 'MAPPED', newTables: 'daily_comments', approxRows: 872, notes: 'Comments on daily content. parent_id for replies. Requires daily_post_id -> daily_content_id lookup via date.' },
    { oldTable: 'dailypostusercomments', status: 'MAPPED', newTables: 'daily_comment_reactions (NEW TABLE)', approxRows: 6733, notes: 'Likes on daily comments. CREATE new daily_comment_reactions table. Import is_liked=1 rows as love/heart.' },
    { oldTable: 'dailypostusers', status: 'MAPPED', newTables: 'daily_reactions + bookmarks', approxRows: 2925, notes: 'DUAL SPLIT: is_liked=1 -> daily_reactions (love/heart), is_bookmarked=1 -> bookmarks.' },
    { oldTable: 'dailychapters', status: 'ALREADY MIGRATED', newTables: 'listen_logs', approxRows: 1737, notes: 'Already migrated separately. No action needed.' },
    // Verse Domain
    { oldTable: 'verses', status: 'SKIP', newTables: '(no equivalent in new schema)', approxRows: 3409, notes: 'Verses handled by daily_content.verse_reference in new schema. No standalone verse table needed.' },
    { oldTable: 'verse_comments', status: 'SKIP', newTables: '(no equivalent in new schema)', approxRows: 42, notes: 'No equivalent. Only 42 comments — superseded by daily_comments.' },
    { oldTable: 'verse_likes', status: 'SKIP', newTables: '(no equivalent in new schema)', approxRows: 3716, notes: 'No equivalent. Verse interactions superseded by daily_reactions.' },
    { oldTable: 'verse_user_comments', status: 'SKIP', newTables: '(no equivalent in new schema)', approxRows: 1, notes: 'No equivalent. Only 1 row.' },
    // Chat Domain
    { oldTable: 'chats', status: 'MAPPED', newTables: 'conversations + conversation_participants + messages', approxRows: 286, notes: 'COMPLEX: flat chat -> grouped conversations + participants + messages.' },
    // Notes Domain
    { oldTable: 'notes', status: 'SKIP', newTables: '(no equivalent in new schema)', approxRows: 68, notes: '68 personal journal entries. No personal notes feature in new app — skip.' },
    // Notifications Domain
    { oldTable: 'notifications', status: 'SKIP', newTables: 'notifications', approxRows: 28480, notes: 'Skip — start fresh. Historical notifications not worth the complex 18->9 column transformation.' },
    // Video Domain
    { oldTable: 'uservideos', status: 'ALREADY MIGRATED', newTables: 'videos', approxRows: 4, notes: 'Already imported. Videos handled differently in new system.' },
    { oldTable: 'uservideorelations', status: 'ALREADY MIGRATED', newTables: 'video_progress', approxRows: 1159, notes: 'Already imported with uservideos.' },
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

  // 5. Run orphan detection
  const orphanResults = detectOrphans(sql);

  // 6. Create table sheets for each configured mapping
  const mappedTables = Object.keys(TABLE_MAPPINGS);
  let sheetsCreated = 0;

  console.log('\nCreating table sheets...');
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

    // Get orphan results for this table
    const tableOrphanResults = orphanResults.get(tableName) || [];

    // Create sheet
    createTableSheet(workbook, tableName, config, sampleRows, columnNames, tableOrphanResults);
    sheetsCreated++;
  }

  // 7. Write Excel file
  console.log(`\nWriting ${OUTPUT_PATH}...`);
  await workbook.xlsx.writeFile(OUTPUT_PATH);

  const stats = fs.statSync(OUTPUT_PATH);
  console.log(`  File size: ${(stats.size / 1024).toFixed(1)} KB`);

  // 8. Summary
  const needsDecisionCount = Object.values(TABLE_MAPPINGS).filter(m => m.status === 'NEEDS DECISION').length;
  console.log('\n=== Summary ===');
  console.log(`  Total tables catalogued: ${ALL_TABLES.length} (non-workshop) + ${EXCLUDED_TABLES.length} (excluded) = ${ALL_TABLES.length + EXCLUDED_TABLES.length} total`);
  console.log(`  Detailed sheets created: ${sheetsCreated}`);
  console.log(`  Total sheets in workbook: ${sheetsCreated + 1} (1 overview + ${sheetsCreated} table sheets)`);
  console.log(`  NEEDS DECISION items: ${needsDecisionCount}`);
  console.log('');
  console.log('  By domain:');
  for (const group of DOMAIN_GROUPS) {
    const statuses = group.tables.map(t => TABLE_MAPPINGS[t]?.status || 'UNKNOWN');
    const mapped = statuses.filter(s => s === 'MAPPED').length;
    const needs = statuses.filter(s => s === 'NEEDS DECISION').length;
    console.log(`    ${group.name}: ${group.tables.length} tables (${mapped} mapped, ${needs} needs decision)`);
  }
  // Orphan summary
  let tablesWithOrphansCount = 0;
  for (const [tableName, results] of orphanResults) {
    if (results.some(r => r.orphanCount > 0)) tablesWithOrphansCount++;
  }
  console.log(`  Tables with orphans detected: ${tablesWithOrphansCount}`);
  console.log(`\n  Output: ${OUTPUT_PATH}`);
  console.log('  Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
