#!/usr/bin/env node
/**
 * Extract specific bible_data rows from old SQL dump files.
 * Outputs full data for dates 2026-02-05 through 2026-02-13.
 *
 * Content DB DailyPostIds: 1744-1752 (Feb 5-13, no-category with bible translations)
 * Media DB DailyPostIds: 737-770+ (Feb 5-13, bible media with audio/SRT)
 * Positivity content: 2114-2131
 * Positivity media: 282-290 (EN), 375-383 (ES)
 */
import { readFileSync, writeFileSync } from 'fs';

const CONTENT_SQL = '/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/Old Database/freelumacontent.sql';
const MEDIA_SQL = '/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/Old Database/freelumamedia.sql';

// We'll use broad ranges and filter by AudioUrl dates or content
// Content DB: DailyPostIds 1744-1752 for Bible, 2114-2131 for Positivity
const CONTENT_IDS = new Set([
  1744, 1745, 1746, 1747, 1748, 1749, 1750, 1751, 1752,
  // Positivity
  2114, 2115, 2116, 2117, 2118, 2119, 2120, 2121, 2122, 2123,
  2124, 2125, 2126, 2127, 2128, 2129, 2130, 2131,
]);

// Media DB: broad range 737-770 for Bible, 282-290 and 375-383 for Positivity
const MEDIA_IDS = new Set([
  ...Array.from({ length: 770 - 737 + 1 }, (_, i) => 737 + i),
  ...Array.from({ length: 290 - 282 + 1 }, (_, i) => 282 + i),
  ...Array.from({ length: 383 - 375 + 1 }, (_, i) => 375 + i),
]);

/**
 * Parse SQL VALUES rows from a file, extracting rows where DailyPostId matches.
 */
function extractRows(filePath, targetIds) {
  const sql = readFileSync(filePath, 'utf8');
  const results = [];

  // Find all INSERT INTO bible_data statements
  const insertRe = /INSERT INTO `bible_data`[\s\S]*?VALUES\s*/g;
  let insertMatch;

  while ((insertMatch = insertRe.exec(sql)) !== null) {
    let pos = insertMatch.index + insertMatch[0].length;

    // Parse individual row tuples
    while (pos < sql.length) {
      // Skip whitespace/newlines
      while (pos < sql.length && /[\s\n\r]/.test(sql[pos])) pos++;

      if (sql[pos] !== '(') break;

      const tuple = parseTuple(sql, pos);
      if (!tuple) {
        console.error(`Failed to parse tuple at position ${pos}, char: ${sql.substring(pos, pos + 50)}`);
        break;
      }

      const { values, endPos } = tuple;
      const dailyPostId = parseInt(values[1]);

      if (targetIds.has(dailyPostId)) {
        results.push({
          Id: parseInt(values[0]),
          DailyPostId: dailyPostId,
          TranslationAbv: values[2],
          Language: values[3],
          Book: values[4],
          VerseReference: values[5],
          VerseText: values[6],
          ChapterText: values[7],
          CreatedAt: values[8],
          UpdatedAt: values[9],
          AudioUrl: values[10],
          AudioKey: values[11],
          SrtUrl: values[12],
          SrtKey: values[13],
        });
      }

      pos = endPos;
      while (pos < sql.length && /[\s\n\r]/.test(sql[pos])) pos++;
      if (sql[pos] === ',') {
        pos++;
      } else if (sql[pos] === ';') {
        pos++;
        break;
      } else {
        break;
      }
    }
  }

  return results;
}

function parseTuple(sql, start) {
  if (sql[start] !== '(') return null;
  let pos = start + 1;
  const values = [];

  while (pos < sql.length) {
    while (pos < sql.length && sql[pos] === ' ') pos++;

    if (sql[pos] === ')') {
      pos++;
      return { values, endPos: pos };
    }

    if (values.length > 0) {
      if (sql[pos] === ',') {
        pos++;
        while (pos < sql.length && sql[pos] === ' ') pos++;
      }
    }

    if (sql.substring(pos, pos + 4) === 'NULL') {
      values.push(null);
      pos += 4;
    } else if (sql[pos] === '\'') {
      const result = parseQuotedString(sql, pos);
      if (!result) return null;
      values.push(result.value);
      pos = result.endPos;
    } else {
      let numStr = '';
      while (pos < sql.length && /[0-9.\-]/.test(sql[pos])) {
        numStr += sql[pos];
        pos++;
      }
      values.push(numStr);
    }
  }
  return null;
}

function parseQuotedString(sql, start) {
  if (sql[start] !== '\'') return null;
  let pos = start + 1;
  let value = '';

  while (pos < sql.length) {
    if (sql[pos] === '\\') {
      pos++;
      if (pos >= sql.length) break;
      switch (sql[pos]) {
        case '\'': value += '\''; break;
        case '\\': value += '\\'; break;
        case 'n': value += '\n'; break;
        case 'r': value += '\r'; break;
        case 't': value += '\t'; break;
        case '0': value += '\0'; break;
        default: value += sql[pos]; break;
      }
      pos++;
    } else if (sql[pos] === '\'') {
      if (pos + 1 < sql.length && sql[pos + 1] === '\'') {
        value += '\'';
        pos += 2;
      } else {
        pos++;
        return { value, endPos: pos };
      }
    } else {
      value += sql[pos];
      pos++;
    }
  }
  return { value, endPos: pos };
}

// ========================
// Extract
// ========================
console.log('=== Extracting from freelumacontent.sql ===');
const contentRows = extractRows(CONTENT_SQL, CONTENT_IDS);
console.log(`Found ${contentRows.length} rows from content DB\n`);

console.log('=== Extracting from freelumamedia.sql ===');
const mediaRows = extractRows(MEDIA_SQL, MEDIA_IDS);
console.log(`Found ${mediaRows.length} rows from media DB\n`);

// ========================
// Display content rows grouped by DailyPostId
// ========================
function displayGrouped(rows, label) {
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.DailyPostId]) grouped[row.DailyPostId] = [];
    grouped[row.DailyPostId].push(row);
  }
  const sortedIds = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  console.log(`\n${'='.repeat(60)}`);
  console.log(label);
  console.log(`${'='.repeat(60)}\n`);

  for (const dpId of sortedIds) {
    const rows = grouped[dpId];
    console.log(`\n--- DailyPostId: ${dpId} (${rows.length} rows) ---`);
    for (const row of rows) {
      console.log(`  [Id=${row.Id}] TranslationAbv=${row.TranslationAbv} | Language=${row.Language}`);
      console.log(`    Book: ${row.Book}`);
      console.log(`    VerseReference: ${row.VerseReference}`);
      console.log(`    VerseText (${(row.VerseText || '').length} chars): ${row.VerseText}`);
      console.log(`    ChapterText: ${(row.ChapterText || '').length} chars`);
      if (row.ChapterText && row.ChapterText.length > 0) {
        // Print first 200 chars + last 100 chars for brevity
        const ct = row.ChapterText;
        if (ct.length <= 400) {
          console.log(`    ChapterText full: ${ct}`);
        } else {
          console.log(`    ChapterText start: ${ct.substring(0, 200)}...`);
          console.log(`    ChapterText end: ...${ct.substring(ct.length - 100)}`);
        }
      }
      console.log(`    AudioUrl: ${row.AudioUrl}`);
      console.log(`    SrtUrl: ${row.SrtUrl}`);
      console.log('');
    }
  }
}

displayGrouped(contentRows, 'CONTENT DATABASE (freelumacontent)');
displayGrouped(mediaRows, 'MEDIA DATABASE (freelumamedia)');

// Save full JSON
const outputData = { content: contentRows, media: mediaRows };
const jsonPath = '/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/scripts/bible-data-extract.json';
writeFileSync(jsonPath, JSON.stringify(outputData, null, 2));
console.log(`\nFull JSON written to: ${jsonPath}`);
console.log(`Content rows: ${contentRows.length}, Media rows: ${mediaRows.length}`);
