/**
 * SRT Subtitle Generator
 *
 * Converts timing data from TTS providers (ElevenLabs character alignment,
 * Murf word durations) into valid .srt format strings.
 *
 * The pipeline uses this to generate subtitle files that accompany
 * each audio track for video overlay rendering.
 */

/**
 * A single word with its start and end time in seconds.
 */
export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

/**
 * ElevenLabs character-level alignment data.
 * Property names match the SDK's camelCase response format.
 */
export interface ElevenLabsAlignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

/**
 * Murf word duration entry (supports both start/end and duration-only formats).
 */
export interface MurfWordDuration {
  word: string;
  start?: number;
  end?: number;
  duration?: number;
}

/**
 * Format a time in seconds to SRT timestamp format: "HH:MM:SS,mmm"
 *
 * @param seconds - Time in seconds (e.g., 1.5 => "00:00:01,500")
 */
export function formatSrtTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hrs = Math.floor(totalMin / 60);

  return (
    String(hrs).padStart(2, '0') +
    ':' +
    String(min).padStart(2, '0') +
    ':' +
    String(sec).padStart(2, '0') +
    ',' +
    String(ms).padStart(3, '0')
  );
}

/**
 * Generate a valid .srt format string from word timing data.
 *
 * Groups words into subtitle lines of up to `maxWordsPerLine` words,
 * using the start time of the first word and end time of the last word
 * in each group as the subtitle timing.
 *
 * @param words - Array of word timing objects
 * @param maxWordsPerLine - Maximum words per subtitle line (default 8)
 * @returns Valid .srt format string
 */
export function generateSrt(
  words: WordTiming[],
  maxWordsPerLine: number = 8
): string {
  if (words.length === 0) return '';

  const lines: string[] = [];
  let index = 1;

  for (let i = 0; i < words.length; i += maxWordsPerLine) {
    const group = words.slice(i, i + maxWordsPerLine);
    const startTime = group[0].startTime;
    const endTime = group[group.length - 1].endTime;
    const text = group.map((w) => w.word).join(' ');

    lines.push(
      `${index}`,
      `${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}`,
      text,
      '' // blank line separator
    );
    index++;
  }

  return lines.join('\n');
}

/**
 * Convert ElevenLabs character-level alignment to word-level timing.
 *
 * Groups consecutive non-whitespace characters into words, using
 * the start time of the first character and end time of the last
 * character in each word.
 *
 * @param alignment - ElevenLabs character alignment response
 * @returns Array of word timing objects
 */
export function characterAlignmentToWords(
  alignment: ElevenLabsAlignment
): WordTiming[] {
  const { characters, characterStartTimesSeconds, characterEndTimesSeconds } =
    alignment;

  if (characters.length === 0) return [];

  const words: WordTiming[] = [];
  let currentWord = '';
  let wordStart = -1;
  let wordEnd = -1;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const charStart = characterStartTimesSeconds[i] ?? 0;
    const charEnd = characterEndTimesSeconds[i] ?? charStart;

    if (char === ' ' || char === '\n' || char === '\t') {
      // Whitespace boundary: emit the accumulated word if any
      if (currentWord.length > 0) {
        words.push({
          word: currentWord,
          startTime: wordStart,
          endTime: wordEnd,
        });
        currentWord = '';
        wordStart = -1;
        wordEnd = -1;
      }
    } else {
      // Non-whitespace character: accumulate into current word
      currentWord += char;
      if (wordStart < 0) {
        wordStart = charStart;
      }
      wordEnd = charEnd;
    }
  }

  // Emit the last word if the string doesn't end with whitespace
  if (currentWord.length > 0) {
    words.push({
      word: currentWord,
      startTime: wordStart,
      endTime: wordEnd,
    });
  }

  return words;
}

/**
 * Convert Murf word duration format to WordTiming array.
 *
 * Handles two formats defensively:
 * - Objects with `start` and `end` properties (preferred)
 * - Objects with only `duration` property (cumulative start/end computed)
 *
 * @param wordDurations - Array of Murf word duration entries
 * @returns Array of word timing objects
 */
export function murfDurationsToWords(
  wordDurations: MurfWordDuration[]
): WordTiming[] {
  if (wordDurations.length === 0) return [];

  const words: WordTiming[] = [];
  let cumulativeTime = 0;

  for (const entry of wordDurations) {
    if (
      typeof entry.start === 'number' &&
      typeof entry.end === 'number'
    ) {
      // Format with explicit start/end
      words.push({
        word: entry.word,
        startTime: entry.start,
        endTime: entry.end,
      });
    } else if (typeof entry.duration === 'number') {
      // Duration-only format: compute cumulative timing
      words.push({
        word: entry.word,
        startTime: cumulativeTime,
        endTime: cumulativeTime + entry.duration,
      });
      cumulativeTime += entry.duration;
    } else {
      // Fallback: include word with zero duration at current position
      words.push({
        word: entry.word,
        startTime: cumulativeTime,
        endTime: cumulativeTime,
      });
    }
  }

  return words;
}
