'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';

interface SubtitleEntry {
  id: string;
  startTime: string;
  startSeconds: number;
  endTime: string;
  endSeconds: number;
  text: string;
}

interface SubtitleDisplayProps {
  srtUrl: string | null;
  currentTime: number;
}

/**
 * Parse SRT content into timed subtitle entries.
 * Uses srt-parser-2 library.
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

export function SubtitleDisplay({ srtUrl, currentTime }: SubtitleDisplayProps) {
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

  // Find active subtitle index
  const activeIndex = subtitles.findIndex(
    (sub) => currentTime >= sub.startSeconds && currentTime <= sub.endSeconds
  );

  // Auto-scroll to keep active subtitle visible
  const scrollToActive = useCallback(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();

      // Center the active element in the container
      const offset = activeRect.top - containerRect.top - containerRect.height / 2 + activeRect.height / 2;
      container.scrollBy({ top: offset, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (activeIndex >= 0) {
      scrollToActive();
    }
  }, [activeIndex, scrollToActive]);

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

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scroll-smooth px-4 py-6"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
      }}
    >
      <div className="flex flex-col gap-3 py-16">
        {subtitles.map((sub, index) => {
          const isActive = index === activeIndex;
          const isPast = activeIndex >= 0 && index < activeIndex;

          return (
            <div
              key={sub.id}
              ref={isActive ? activeRef : undefined}
              className={cn(
                'text-center transition-all duration-300 ease-in-out',
                isActive
                  ? 'scale-105 text-lg font-medium text-white sm:text-xl'
                  : isPast
                    ? 'text-base text-white/30'
                    : 'text-base text-white/50'
              )}
            >
              {sub.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
