/**
 * Bible Verse Selection Module
 *
 * Selects a random unused KJV verse from the complete 31,102-verse index.
 * Tracks used verses via the UsedBibleVerse model to prevent repetition.
 *
 * NOTE: This function does NOT record the verse as used. The pipeline runner
 * handles that after successful content creation, ensuring idempotency.
 */

import { ALL_KJV_VERSES, KJV_VERSE_COUNT } from './bible-verse-index.js';
import type { VerseReference } from './bible-verse-index.js';

/**
 * Select a random unused KJV verse.
 *
 * Algorithm:
 * 1. Fetch all used verse references from the database
 * 2. Build a Set of used keys for O(1) lookup
 * 3. Filter the full 31,102-verse index to exclude used verses
 * 4. Pick a random element from the remaining pool
 *
 * @returns A verse reference object (book, chapter, verse, reference)
 * @throws Error if all 31,102 verses have been used
 */
export async function selectRandomUnusedVerse(): Promise<VerseReference> {
  // Dynamic import to avoid circular dependency and allow this module
  // to be used before the database is fully initialized
  const { UsedBibleVerse } = await import('@/lib/db/models/index.js');

  // Fetch all used verses (only the fields needed for the key)
  const usedRows = await UsedBibleVerse.findAll({
    attributes: ['book', 'chapter', 'verse'],
    raw: true,
  });

  // Build a Set of used verse keys for O(1) exclusion
  const usedKeys = new Set<string>(
    usedRows.map((row: { book: string; chapter: number; verse: number }) =>
      `${row.book}:${row.chapter}:${row.verse}`
    )
  );

  // Filter to unused verses
  const unusedVerses = ALL_KJV_VERSES.filter(
    (v: VerseReference) => !usedKeys.has(`${v.book}:${v.chapter}:${v.verse}`)
  );

  if (unusedVerses.length === 0) {
    throw new Error(
      `All ${KJV_VERSE_COUNT} KJV verses have been used. ` +
      'Consider clearing the used_bible_verses table to restart the cycle.'
    );
  }

  // Pick a random unused verse
  const randomIndex = Math.floor(Math.random() * unusedVerses.length);
  return unusedVerses[randomIndex];
}
