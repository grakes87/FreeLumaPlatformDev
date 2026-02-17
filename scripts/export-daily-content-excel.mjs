#!/usr/bin/env node
/**
 * Export all daily_content and daily_content_translations to a styled Excel file.
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

// ── Styling helpers ──
const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } };
const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const thinBorder = {
  top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
};

function styleSheet(ws, colWidths) {
  // Set column widths
  ws.columns = colWidths.map(w => ({ width: w }));

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  headerRow.height = 22;

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto-filter
  ws.autoFilter = { from: 'A1', to: { row: 1, column: colWidths.length } };
}

// ── Tab 1: daily_content ──
console.log('Fetching daily_content...');
const [dcRows] = await conn.query(
  `SELECT id, post_date, mode, title, content_text, verse_reference, chapter_reference,
          video_background_url, lumashort_video_url, language, published, created_at, updated_at
   FROM daily_content ORDER BY post_date, language`
);

const ws1 = wb.addWorksheet('daily_content');
ws1.addRow([
  'ID', 'Post Date', 'Mode', 'Title', 'Content Text', 'Verse Reference',
  'Chapter Reference', 'Video Background URL', 'LumaShort Video URL',
  'Language', 'Published', 'Created At', 'Updated At',
]);

for (const r of dcRows) {
  const postDate = r.post_date instanceof Date
    ? r.post_date.toISOString().slice(0, 10)
    : String(r.post_date).slice(0, 10);
  ws1.addRow([
    r.id, postDate, r.mode, r.title || '', r.content_text || '',
    r.verse_reference || '', r.chapter_reference || '',
    r.video_background_url || '', r.lumashort_video_url || '',
    r.language, r.published ? 'Yes' : 'No',
    r.created_at, r.updated_at,
  ]);
}

styleSheet(ws1, [8, 14, 10, 20, 50, 22, 22, 45, 45, 10, 10, 20, 20]);

// Style data rows
for (let i = 2; i <= ws1.rowCount; i++) {
  const row = ws1.getRow(i);
  row.eachCell(cell => {
    cell.border = thinBorder;
    cell.alignment = { vertical: 'top', wrapText: true };
  });
}

// ── Tab 2: daily_content_translations ──
console.log('Fetching daily_content_translations...');
const [dctRows] = await conn.query(
  `SELECT dct.id, dct.daily_content_id, dc.post_date, dc.language AS dc_language,
          dct.translation_code, dct.translated_text, dct.chapter_text,
          dct.verse_reference, dct.audio_url, dct.audio_srt_url,
          dct.source, dct.created_at, dct.updated_at
   FROM daily_content_translations dct
   JOIN daily_content dc ON dc.id = dct.daily_content_id
   ORDER BY dc.post_date, dc.language, dct.translation_code`
);

const ws2 = wb.addWorksheet('daily_content_translations');
ws2.addRow([
  'ID', 'Daily Content ID', 'Post Date', 'DC Language', 'Translation Code',
  'Translated Text', 'Chapter Text', 'Verse Reference',
  'Audio URL', 'Audio SRT URL', 'Source', 'Created At', 'Updated At',
]);

for (const r of dctRows) {
  const postDate = r.post_date instanceof Date
    ? r.post_date.toISOString().slice(0, 10)
    : String(r.post_date).slice(0, 10);

  // Truncate chapter_text for readability (show first 200 chars)
  const chapterPreview = r.chapter_text
    ? (r.chapter_text.length > 200 ? r.chapter_text.slice(0, 200) + '...' : r.chapter_text)
    : '';

  ws2.addRow([
    r.id, r.daily_content_id, postDate, r.dc_language, r.translation_code,
    r.translated_text || '', chapterPreview, r.verse_reference || '',
    r.audio_url || '', r.audio_srt_url || '',
    r.source, r.created_at, r.updated_at,
  ]);
}

styleSheet(ws2, [8, 16, 14, 12, 16, 55, 55, 22, 45, 45, 10, 20, 20]);

for (let i = 2; i <= ws2.rowCount; i++) {
  const row = ws2.getRow(i);
  row.eachCell(cell => {
    cell.border = thinBorder;
    cell.alignment = { vertical: 'top', wrapText: true };
  });
}

// ── Save ──
const outPath = path.join(__dirname, '..', 'daily-content-export.xlsx');
await wb.xlsx.writeFile(outPath);

console.log(`\nExported:`);
console.log(`  daily_content: ${dcRows.length} rows`);
console.log(`  daily_content_translations: ${dctRows.length} rows`);
console.log(`  File: ${outPath}`);

await conn.end();
