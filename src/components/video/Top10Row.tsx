'use client';

import { useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { VideoData } from './VideoCard';

interface Top10RowProps {
  videos: VideoData[];
  className?: string;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Top10Row({ videos, className }: Top10RowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollRight = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 240, behavior: 'smooth' });
    }
  }, []);

  if (videos.length === 0) return null;

  return (
    <section className={cn('flex flex-col gap-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        <h3 className="text-base font-semibold text-text dark:text-text-dark">
          Top 10 Most Watched
        </h3>
        {videos.length > 2 && (
          <button
            type="button"
            onClick={scrollRight}
            className="flex items-center gap-0.5 text-xs font-medium text-primary"
            aria-label="See more Top 10"
          >
            More
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Horizontal scroll */}
      <div
        ref={scrollRef}
        className={cn(
          'flex gap-3 overflow-x-auto px-4 pb-1',
          'scrollbar-none',
          '[scroll-snap-type:x_mandatory]',
          '[-webkit-overflow-scrolling:touch]'
        )}
      >
        {videos.map((video, index) => (
          <Top10Card key={video.id} video={video} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}

function Top10Card({ video, rank }: { video: VideoData; rank: number }) {
  return (
    <Link
      href={`/watch/${video.id}`}
      className="flex w-48 shrink-0 snap-start items-end gap-0"
    >
      {/* Large rank number */}
      <span
        className={cn(
          'shrink-0 select-none text-[64px] font-black leading-none tracking-tighter',
          'text-transparent',
          '[-webkit-text-stroke:2px_currentColor]',
          'text-text/30 dark:text-text-dark/30'
        )}
        style={{ marginRight: '-8px', marginBottom: '-4px' }}
      >
        {rank}
      </span>

      {/* Card */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10 dark:from-primary/20 dark:to-primary/5">
              <svg
                className="h-8 w-8 text-primary/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                />
              </svg>
            </div>
          )}

          {/* Duration badge */}
          {video.duration_seconds > 0 && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
              {formatDuration(video.duration_seconds)}
            </span>
          )}
        </div>

        <div className="px-0.5">
          <h4 className="line-clamp-2 text-xs font-medium leading-tight text-text dark:text-text-dark">
            {video.title}
          </h4>
        </div>
      </div>
    </Link>
  );
}
