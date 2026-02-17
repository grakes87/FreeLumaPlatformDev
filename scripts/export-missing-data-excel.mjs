#!/usr/bin/env node
/**
 * Export daily_content and daily_content_translations rows that have
 * NULL/empty values in any important column. Two tabs in one Excel file.
 */
import mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev',
});

const wb = new ExcelJS.Workbook();
wb.creator = 'FreeLuma Export';
wb.created = new Date();

const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } };
const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const missingFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
const thinBorder = {
  top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
};

function styleSheet(ws, colWidths) {
  ws.columns = colWidths.map(w => ({ width: w }));
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  headerRow.height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: { row: 1, column: colWidths.length } };
}

// ── Tab 1: daily_content with missing data ──
console.log('Fetching daily_content with missing data...');
const [dcRows] = await conn.query(`
  SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') as post_date, mode, language,
         title, content_text, verse_reference, chapter_reference,
         video_background_url, lumashort_video_url, published
  FROM daily_content
  WHERE post_date BETWEEN '2026-01-01' AND '2026-03-31'
    AND (
      (mode = 'bible' AND (content_text IS NULL OR content_text = ''))
      OR (mode = 'bible' AND (verse_reference IS NULL OR verse_reference = ''))
      OR (mode = 'bible' AND (chapter_reference IS NULL OR chapter_reference = ''))
      OR video_background_url IS NULL OR video_background_url = ''
      OR lumashort_video_url IS NULL OR lumashort_video_url = ''
    )
  ORDER BY post_date, language
`);

const ws1 = wb.addWorksheet('daily_content');
const dc_headers = [
  'ID', 'Post Date', 'Mode', 'Language', 'Title', 'Content Text',
  'Verse Reference', 'Chapter Reference', 'Video Background URL',
  'LumaShort Video URL', 'Published', 'Missing Fields',
];
ws1.addRow(dc_headers);

// Column indices for highlight (0-based in headers array)
const dcCheckFields = {
  'Content Text': 5, 'Verse Reference': 6, 'Chapter Reference': 7,
  'Video Background URL': 8, 'LumaShort Video URL': 9,
};

for (const r of dcRows) {
  const missing = [];
  if (r.mode === 'bible' && (!r.content_text)) missing.push('content_text');
  if (r.mode === 'bible' && (!r.verse_reference)) missing.push('verse_reference');
  if (r.mode === 'bible' && (!r.chapter_reference)) missing.push('chapter_reference');
  if (!r.video_background_url) missing.push('video_background_url');
  if (!r.lumashort_video_url) missing.push('lumashort_video_url');

  const rowNum = ws1.addRow([
    r.id, r.post_date, r.mode, r.language,
    r.title || '', r.content_text || '',
    r.verse_reference || '', r.chapter_reference || '',
    r.video_background_url || '', r.lumashort_video_url || '',
    r.published ? 'Yes' : 'No', missing.join(', '),
  ]).number;

  // Highlight empty cells yellow
  const row = ws1.getRow(rowNum);
  row.eachCell(cell => {
    cell.border = thinBorder;
    cell.alignment = { vertical: 'top', wrapText: true };
  });
  for (const [fieldName, colIdx] of Object.entries(dcCheckFields)) {
    const cell = row.getCell(colIdx + 1); // 1-based
    if (!cell.value || cell.value === '') {
      cell.fill = missingFill;
    }
  }
}

styleSheet(ws1, [8, 14, 10, 10, 20, 40, 22, 22, 45, 45, 10, 35]);
console.log(`  daily_content: ${dcRows.length} rows with missing data`);

// ── Tab 2: daily_content_translations with missing data ──
console.log('Fetching daily_content_translations with missing data...');
const [dctRows] = await conn.query(`
  SELECT dct.id, dct.daily_content_id, DATE_FORMAT(dc.post_date, '%Y-%m-%d') as post_date,
         dc.language as dc_language, dct.translation_code,
         dct.translated_text, dct.chapter_text, dct.verse_reference,
         dct.audio_url, dct.audio_srt_url, dct.source
  FROM daily_content_translations dct
  JOIN daily_content dc ON dc.id = dct.daily_content_id
  WHERE dc.post_date BETWEEN '2026-01-01' AND '2026-03-31'
    AND (
      dct.translated_text IS NULL OR dct.translated_text = ''
      OR dct.chapter_text IS NULL OR dct.chapter_text = ''
      OR dct.verse_reference IS NULL OR dct.verse_reference = ''
      OR dct.audio_url IS NULL OR dct.audio_url = ''
      OR dct.audio_srt_url IS NULL OR dct.audio_srt_url = ''
    )
  ORDER BY dc.post_date, dc.language, dct.translation_code
`);

const ws2 = wb.addWorksheet('daily_content_translations');
ws2.addRow([
  'ID', 'DC ID', 'Post Date', 'DC Language', 'Translation Code',
  'Translated Text', 'Chapter Text', 'Verse Reference',
  'Audio URL', 'Audio SRT URL', 'Source', 'Missing Fields',
]);

const dctCheckFields = {
  'translated_text': 5, 'chapter_text': 6, 'verse_reference': 7,
  'audio_url': 8, 'audio_srt_url': 9,
};

for (const r of dctRows) {
  const missing = [];
  if (!r.translated_text) missing.push('translated_text');
  if (!r.chapter_text) missing.push('chapter_text');
  if (!r.verse_reference) missing.push('verse_reference');
  if (!r.audio_url) missing.push('audio_url');
  if (!r.audio_srt_url) missing.push('audio_srt_url');

  // Truncate long text for readability
  const textPreview = r.translated_text
    ? (r.translated_text.length > 100 ? r.translated_text.slice(0, 100) + '...' : r.translated_text)
    : '';
  const chapterPreview = r.chapter_text
    ? (r.chapter_text.length > 100 ? r.chapter_text.slice(0, 100) + '...' : r.chapter_text)
    : '';

  const rowNum = ws2.addRow([
    r.id, r.daily_content_id, r.post_date, r.dc_language, r.translation_code,
    textPreview, chapterPreview, r.verse_reference || '',
    r.audio_url || '', r.audio_srt_url || '',
    r.source, missing.join(', '),
  ]).number;

  const row = ws2.getRow(rowNum);
  row.eachCell(cell => {
    cell.border = thinBorder;
    cell.alignment = { vertical: 'top', wrapText: true };
  });
  for (const [fieldName, colIdx] of Object.entries(dctCheckFields)) {
    const cell = row.getCell(colIdx + 1);
    if (!cell.value || cell.value === '') {
      cell.fill = missingFill;
    }
  }
}

styleSheet(ws2, [8, 10, 14, 12, 16, 45, 45, 22, 45, 45, 10, 35]);
console.log(`  daily_content_translations: ${dctRows.length} rows with missing data`);

// ── Save ──
const outPath = path.join(__dirname, '..', 'daily-content-missing-data.xlsx');
await wb.xlsx.writeFile(outPath);

console.log(`\nFile: ${outPath}`);

await conn.end();
