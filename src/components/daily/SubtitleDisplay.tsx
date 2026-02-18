'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';

interface SubtitleEntry {
  id: string;
  startTime: string;
  startSeconds: number;
  endTime: string;
  endSeconds: number;
  text: string;
}

interface VerseEntry {
  verseNum: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

interface SubtitleDisplayProps {
  srtUrl: string | null;
  chapterText: string | null;
  currentTime: number;
  isPlaying: boolean;
}

/**
 * Parse SRT content into timed subtitle entries.
 */
async function parseSrt(content: string): Promise<SubtitleEntry[]> {
  const { default: SrtParser } = await import('srt-parser-2');
  const parser = new SrtParser();
  const result = parser.fromSrt(content);
  return result.map((entry) => ({
    id: entry.id,
    startTime: entry.startTime,
    startSeconds: entry.startSeconds,
    endTime: entry.endTime,
    endSeconds: entry.endSeconds,
    text: entry.text,
  }));
}

/**
 * Normalize text for fuzzy matching: lowercase, strip punctuation, collapse whitespace.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a word-level timeline from SRT entries.
 * Each word gets an estimated timestamp by interpolating within its SRT entry.
 */
interface WordTiming {
  word: string;
  time: number; // estimated seconds
}

function buildWordTimeline(subtitles: SubtitleEntry[]): WordTiming[] {
  const timeline: WordTiming[] = [];
  for (const sub of subtitles) {
    const words = normalize(sub.text).split(' ').filter(Boolean);
    if (words.length === 0) continue;
    const duration = sub.endSeconds - sub.startSeconds;
    for (let i = 0; i < words.length; i++) {
      // Interpolate each word's time within the SRT entry
      const fraction = words.length === 1 ? 0.5 : i / (words.length - 1);
      timeline.push({
        word: words[i],
        time: sub.startSeconds + duration * fraction,
      });
    }
  }
  return timeline;
}

/**
 * Map SRT phrase entries to verse boundaries using chapter_text.
 *
 * Strategy: Build a word-level timeline from SRT, then walk through verse words
 * sequentially to find where each verse ends in the timeline. Timing is
 * continuous — each verse ends where the next begins.
 */
function mapSrtToVerses(subtitles: SubtitleEntry[], chapterText: string): VerseEntry[] {
  const verses = chapterText.split('|').map((v) => v.trim()).filter(Boolean);
  if (verses.length === 0 || subtitles.length === 0) return [];

  const timeline = buildWordTimeline(subtitles);
  if (timeline.length === 0) return [];

  const totalDuration = subtitles[subtitles.length - 1].endSeconds;

  // Calculate cumulative word counts for proportional timing
  const verseWordCounts = verses.map((v) => normalize(v).split(' ').filter(Boolean).length);
  const totalWords = verseWordCounts.reduce((a, b) => a + b, 0);

  // Assign timing proportionally based on word count
  // This is the most reliable method since SRT transcription often
  // differs from chapter_text (different words, contractions, etc.)
  const result: VerseEntry[] = [];
  let cumulativeWords = 0;
  const audioStart = subtitles[0].startSeconds;

  for (let v = 0; v < verses.length; v++) {
    const startFraction = cumulativeWords / totalWords;
    cumulativeWords += verseWordCounts[v];
    const endFraction = cumulativeWords / totalWords;

    // Map fractions to timeline positions
    const startWordIdx = Math.round(startFraction * (timeline.length - 1));
    const endWordIdx = Math.min(
      timeline.length - 1,
      Math.round(endFraction * (timeline.length - 1))
    );

    const startTime = v === 0 ? audioStart : timeline[startWordIdx]?.time ?? audioStart;
    const endTime = v === verses.length - 1
      ? totalDuration
      : timeline[endWordIdx]?.time ?? totalDuration;

    result.push({
      verseNum: v + 1,
      text: verses[v],
      startSeconds: startTime,
      endSeconds: endTime,
    });
  }

  // Make timing continuous: each verse ends where the next starts
  for (let i = 0; i < result.length - 1; i++) {
    result[i].endSeconds = result[i + 1].startSeconds;
  }

  return result;
}

export function SubtitleDisplay({ srtUrl, chapterText, currentTime, isPlaying }: SubtitleDisplayProps) {
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Fetch and parse SRT file
  useEffect(() => {
    if (!srtUrl) {
      setSubtitles([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(srtUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load subtitles');
        return res.text();
      })
      .then((text) => parseSrt(text))
      .then((entries) => {
        if (!cancelled) {
          setSubtitles(entries);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[SubtitleDisplay] SRT parse error:', err);
          setError('Subtitles not available');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [srtUrl]);

  // Map SRT entries to verses when chapter_text is available
  const verseEntries = useMemo(() => {
    if (!chapterText || subtitles.length === 0) return null;
    return mapSrtToVerses(subtitles, chapterText);
  }, [subtitles, chapterText]);

  // Find active index (verse-mode or phrase-mode)
  const activeIndex = verseEntries
    ? verseEntries.findIndex(
        (v) => currentTime >= v.startSeconds && currentTime <= v.endSeconds
      )
    : subtitles.findIndex(
        (sub) => currentTime >= sub.startSeconds && currentTime <= sub.endSeconds
      );

  // Auto-scroll to keep active entry centered (within subtitle container only)
  useEffect(() => {
    const container = containerRef.current;
    const element = activeRef.current;
    if (activeIndex < 0 || !container || !element) return;

    const scrollTarget =
      element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2;
    container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  }, [activeIndex]);

  if (!srtUrl) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-white/40">Subtitles not available</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="animate-pulse text-sm text-white/40">Loading subtitles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-white/40">{error}</p>
      </div>
    );
  }

  // Verse-aligned mode (chapter_text available)
  if (verseEntries && verseEntries.length > 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scroll-smooth px-4 py-6"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
        }}
      >
        <div className="flex flex-col gap-5 py-16">
          {verseEntries.map((verse, index) => {
            const isActive = index === activeIndex;
            const isPast = activeIndex >= 0 && index < activeIndex;
            const isIdle = !isPlaying;

            return (
              <div
                key={verse.verseNum}
                ref={isActive ? activeRef : undefined}
                className={cn(
                  'border-l-2 pl-4 text-left leading-relaxed transition-all duration-300 ease-in-out',
                  isIdle
                    ? 'border-transparent text-white'
                    : isActive
                      ? 'border-white text-white'
                      : isPast
                        ? 'border-transparent text-white/25'
                        : 'border-transparent text-white/40'
                )}
                style={{ fontFamily: 'var(--font-daily-subtitle, inherit)' }}
              >
                <span
                  className={cn(
                    'mr-1.5 inline-block text-xs font-semibold tabular-nums align-super',
                    isIdle
                      ? 'text-white/50'
                      : isActive
                        ? 'text-white/70'
                        : 'text-white/30'
                  )}
                >
                  {verse.verseNum}
                </span>
                <span className="text-base sm:text-lg">{verse.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback: phrase-level mode (no chapter_text)
  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scroll-smooth px-4 py-6"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
      }}
    >
      <div className="flex flex-col gap-6 py-16">
        {subtitles.map((sub, index) => {
          const isActive = index === activeIndex;
          const isPast = activeIndex >= 0 && index < activeIndex;
          const isIdle = !isPlaying;

          return (
            <div
              key={sub.id}
              ref={isActive ? activeRef : undefined}
              className={cn(
                'border-l-2 pl-4 text-left text-lg leading-relaxed transition-all duration-300 ease-in-out sm:text-xl',
                isIdle
                  ? 'border-transparent text-white'
                  : isActive
                    ? 'border-white text-white'
                    : isPast
                      ? 'border-transparent text-white/25'
                      : 'border-transparent text-white/40'
              )}
              style={{ fontFamily: 'var(--font-daily-subtitle)' }}
            >
              {sub.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
