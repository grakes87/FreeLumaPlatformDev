/**
 * Clean bracketed content and section headings from verse/chapter translations:
 * 1. Remove section headings + [verse_number] from start of text
 * 2. Remove standalone [number] markers mid-text
 * 3. Remove cross-reference brackets like [Ex 3:14], [Heb 11:13], [Rom 8:28] entirely
 * 4. For AMP-style amplification [word/phrase], keep the content, remove brackets
 * 5. Clean up extra whitespace
 *
 * Also cleans chapter_text: strips |Section Heading| patterns and brackets.
 *
 * Targets: verse_category_content_translations + daily_content_translations
 *
 * Usage:
 *   node scripts/clean-verse-brackets.mjs --dry-run   (preview changes)
 *   node scripts/clean-verse-brackets.mjs              (apply changes)
 */

import mysql from 'mysql2/promise';

const DRY_RUN = process.argv.includes('--dry-run');

const conn = await mysql.createConnection({
  host: '10.0.0.3',
  user: 'freeluma_app',
  password: 'FL!pr0d#X8kM2vR7nQ4wJ9sT3yB6cH1',
  database: 'freeluma_prod',
});

/**
 * Clean verse/translated_text: strip headings, brackets, cross-references.
 */
function cleanVerseText(text) {
  let cleaned = text;

  // 1. Strip heading + [verse_number] from start
  cleaned = cleaned.replace(/^.*?\[\d+\]\s*/, '');

  // 2. Remove any remaining standalone [number] markers mid-text
  cleaned = cleaned.replace(/\s*\[\d+\]\s*/g, ' ');

  // 3. Remove cross-reference brackets entirely — any [text with chapter:verse]
  //    Catches [Ex 3:14], [Heb 11:13], [Rom 8:28], [1 Cor 13:4-7], [Num 18:20], [Mic 7:17]
  cleaned = cleaned.replace(/\s*\[[^\]]*\d+:\d+[^\]]*\]\s*/g, ' ');

  // 4. AMP-style amplification: keep the content, remove brackets
  //    e.g., "[authentic]" → "authentic", "[for the slaves]" → "for the slaves"
  cleaned = cleaned.replace(/\[([^\]]+)\]/g, '$1');

  // 5. Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 6. Ensure starts with capital letter
  if (cleaned && /^[a-z]/.test(cleaned)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Clean chapter_text: strip |Section Heading| patterns and brackets.
 * Keeps | as verse dividers but removes heading text between pipes.
 */
function cleanChapterText(text) {
  let cleaned = text;

  // 1. Remove section headings enclosed in pipes: |Heading Text|
  //    These are Title Case headings like |You Are Built Up in Christ|
  //    Pattern: | followed by title-case words (no verse text), followed by |
  //    Section headings don't contain periods or commas (verse text does)
  cleaned = cleaned.replace(/\|[A-Z][^|]*?[A-Za-z]\|/g, (match) => {
    // Only strip if it looks like a heading (no periods, commas, or lowercase-starting words after first)
    const inner = match.slice(1, -1).trim();
    // Headings are short title-case phrases without sentence punctuation
    if (inner.length < 80 && !/[.;!?]/.test(inner) && /^[A-Z]/.test(inner)) {
      return '|';
    }
    return match;
  });

  // 2. Clean up double pipes from removed headings
  cleaned = cleaned.replace(/\|\s*\|/g, '|');

  // 3. Remove leading pipe
  cleaned = cleaned.replace(/^\s*\|\s*/, '');

  // 4. Remove cross-reference brackets entirely — any [text with chapter:verse]
  cleaned = cleaned.replace(/\s*\[[^\]]*\d+:\d+[^\]]*\]\s*/g, ' ');

  // 5. Remove standalone [number] markers
  cleaned = cleaned.replace(/\s*\[\d+\]\s*/g, ' ');

  // 6. AMP-style amplification: keep content, remove brackets
  cleaned = cleaned.replace(/\[([^\]]+)\]/g, '$1');

  // 7. Clean up whitespace (preserve pipes as verse dividers)
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// ========================================================================
// 1. Clean verse_category_content_translations.translated_text
// ========================================================================
// Use broader REGEXP to catch ALL bracket patterns (including multi-word)
const [vcRows] = await conn.query(
  'SELECT id, translated_text FROM verse_category_content_translations WHERE translated_text LIKE ?',
  ['%[%']
);

console.log(`\n=== verse_category_content_translations: ${vcRows.length} rows to check ===\n`);

let vcUpdated = 0;
let vcSkipped = 0;
const vcSamples = [];

for (const row of vcRows) {
  const cleaned = cleanVerseText(row.translated_text);
  if (cleaned !== row.translated_text) {
    if (vcSamples.length < 12) {
      vcSamples.push({
        id: row.id,
        before: row.translated_text.substring(0, 140),
        after: cleaned.substring(0, 140),
      });
    }
    if (!DRY_RUN) {
      await conn.query('UPDATE verse_category_content_translations SET translated_text = ? WHERE id = ?', [cleaned, row.id]);
    }
    vcUpdated++;
  } else {
    vcSkipped++;
  }
}

console.log('Sample changes:');
vcSamples.forEach((s, i) => {
  console.log(`  ${i + 1}. ID ${s.id}`);
  console.log(`     BEFORE: ${s.before}`);
  console.log(`     AFTER:  ${s.after}`);
  console.log();
});
console.log(`Updated: ${vcUpdated}, Unchanged: ${vcSkipped}`);

// ========================================================================
// 2. Clean daily_content_translations.translated_text
// ========================================================================
const [dcRows] = await conn.query(
  'SELECT id, translated_text FROM daily_content_translations WHERE translated_text LIKE ?',
  ['%[%']
);

console.log(`\n=== daily_content_translations.translated_text: ${dcRows.length} rows to check ===\n`);

let dcUpdated = 0;
let dcSkipped = 0;

for (const row of dcRows) {
  const cleaned = cleanVerseText(row.translated_text);
  if (cleaned !== row.translated_text) {
    console.log(`  ID ${row.id}`);
    console.log(`    BEFORE: ${row.translated_text.substring(0, 160)}`);
    console.log(`    AFTER:  ${cleaned.substring(0, 160)}`);
    console.log();
    if (!DRY_RUN) {
      await conn.query('UPDATE daily_content_translations SET translated_text = ? WHERE id = ?', [cleaned, row.id]);
    }
    dcUpdated++;
  } else {
    dcSkipped++;
  }
}

console.log(`Updated: ${dcUpdated}, Unchanged: ${dcSkipped}`);

// ========================================================================
// 3. Clean daily_content_translations.chapter_text (headings + brackets)
// ========================================================================
const [ctRows] = await conn.query(
  "SELECT id, translation_code, chapter_text FROM daily_content_translations WHERE chapter_text IS NOT NULL AND chapter_text != '' AND (chapter_text LIKE '%[%' OR chapter_text LIKE '%|%')"
);

console.log(`\n=== daily_content_translations.chapter_text: ${ctRows.length} rows to check ===\n`);

let ctUpdated = 0;
let ctSkipped = 0;
const ctSamples = [];

for (const row of ctRows) {
  const cleaned = cleanChapterText(row.chapter_text);
  if (cleaned !== row.chapter_text) {
    if (ctSamples.length < 8) {
      ctSamples.push({
        id: row.id,
        lang: row.translation_code,
        before: row.chapter_text.substring(0, 160),
        after: cleaned.substring(0, 160),
      });
    }
    if (!DRY_RUN) {
      await conn.query('UPDATE daily_content_translations SET chapter_text = ? WHERE id = ?', [cleaned, row.id]);
    }
    ctUpdated++;
  } else {
    ctSkipped++;
  }
}

console.log('Sample chapter_text changes:');
ctSamples.forEach((s, i) => {
  console.log(`  ${i + 1}. ID ${s.id} [${s.lang}]`);
  console.log(`     BEFORE: ${s.before}`);
  console.log(`     AFTER:  ${s.after}`);
  console.log();
});
console.log(`Updated: ${ctUpdated}, Unchanged: ${ctSkipped}`);

// ========================================================================
// Summary
// ========================================================================
const total = vcUpdated + dcUpdated + ctUpdated;
console.log(`\n=== TOTAL: ${total} rows ${DRY_RUN ? 'would be' : ''} updated ===`);
console.log(`  verse_category translations: ${vcUpdated}`);
console.log(`  daily_content translations:  ${dcUpdated}`);
console.log(`  chapter_text:                ${ctUpdated}`);
if (DRY_RUN) console.log('\n(DRY RUN — no changes made. Run without --dry-run to apply.)');

await conn.end();
