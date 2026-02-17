#!/usr/bin/env node
/**
 * Export daily_content and daily_content_translations rows
 * that are missing media files (video, audio, SRT).
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

// ── Tab 1: daily_content missing media ──
console.log('Fetching daily_content with missing media...');
const [dcRows] = await conn.query(`
  SELECT id, DATE_FORMAT(post_date, '%Y-%m-%d') as post_date, mode, language,
         verse_reference, chapter_reference,
         video_background_url, lumashort_video_url
  FROM daily_content
  WHERE post_date BETWEEN '2026-01-01' AND '2026-03-31'
    AND (
      video_background_url IS NULL OR video_background_url = ''
      OR lumashort_video_url IS NULL OR lumashort_video_url = ''
    )
  ORDER BY post_date, language
`);

const ws1 = wb.addWorksheet('daily_content');
ws1.addRow([
  'ID', 'Post Date', 'Mode', 'Language', 'Verse Reference', 'Chapter Reference',
  'Video Background URL', 'LumaShort Video URL', 'Missing Fields',
]);

for (const r of dcRows) {
  const missing = [];
  if (!r.video_background_url) missing.push('video_background_url');
  if (!r.lumashort_video_url) missing.push('lumashort_video_url');

  const rowNum = ws1.addRow([
    r.id, r.post_date, r.mode, r.language,
    r.verse_reference || '', r.chapter_reference || '',
    r.video_background_url || '', r.lumashort_video_url || '',
    missing.join(', '),
  ]).number;

  const row = ws1.getRow(rowNum);
  row.eachCell(cell => {
    cell.border = thinBorder;
    cell.alignment = { vertical: 'top', wrapText: true };
  });
  // Highlight missing cells
  if (!r.video_background_url) row.getCell(7).fill = missingFill;
  if (!r.lumashort_video_url) row.getCell(8).fill = missingFill;
}

styleSheet(ws1, [8, 14, 10, 10, 22, 22, 50, 50, 30]);
console.log(`  daily_content: ${dcRows.length} rows with missing media`);

// ── Tab 2: daily_content_translations missing media ──
console.log('Fetching daily_content_translations with missing media...');
const [dctRows] = await conn.query(`
  SELECT dct.id, dct.daily_content_id, DATE_FORMAT(dc.post_date, '%Y-%m-%d') as post_date,
         dc.language as dc_language, dct.translation_code, dct.verse_reference,
         dct.audio_url, dct.audio_srt_url
  FROM daily_content_translations dct
  JOIN daily_content dc ON dc.id = dct.daily_content_id
  WHERE dc.post_date BETWEEN '2026-01-01' AND '2026-03-31'
    AND (
      dct.audio_url IS NULL OR dct.audio_url = ''
      OR dct.audio_srt_url IS NULL OR dct.audio_srt_url = ''
    )
  ORDER BY dc.post_date, dc.language, dct.translation_code
`);

const ws2 = wb.addWorksheet('daily_content_translations');
ws2.addRow([
  'ID', 'DC ID', 'Post Date', 'Language', 'Translation Code', 'Verse Reference',
  'Audio URL', 'Audio SRT URL', 'Missing Fields',
]);

for (const r of dctRows) {
  const missing = [];
  if (!r.audio_url) missing.push('audio_url');
  if (!r.audio_srt_url) missing.push('audio_srt_url');

  const rowNum = ws2.addRow([
    r.id, r.daily_content_id, r.post_date, r.dc_language, r.translation_code,
    r.verse_reference || '',
    r.audio_url || '', r.audio_srt_url || '',
    missing.join(', '),
  ]).number;

  const row = ws2.getRow(rowNum);
  row.eachCell(cell => {
    cell.border = thinBorder;
    cell.alignment = { vertical: 'top', wrapText: true };
  });
  if (!r.audio_url) row.getCell(7).fill = missingFill;
  if (!r.audio_srt_url) row.getCell(8).fill = missingFill;
}

styleSheet(ws2, [8, 10, 14, 10, 16, 22, 50, 50, 30]);
console.log(`  daily_content_translations: ${dctRows.length} rows with missing media`);

// ── Save ──
const outPath = path.join(__dirname, '..', 'daily-content-missing-media.xlsx');
await wb.xlsx.writeFile(outPath);

console.log(`\nFile: ${outPath}`);

await conn.end();
