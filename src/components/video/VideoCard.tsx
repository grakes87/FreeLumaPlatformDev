'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export interface VideoData {
  id: number;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  video_url?: string;
  duration_seconds: number;
  view_count: number;
  published?: boolean;
  created_at?: string;
  progress?: {
    watched_seconds: number;
    last_position: number;
    duration_seconds: number;
  };
}

interface VideoCardProps {
  video: VideoData;
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

function formatViewCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K views`;
  }
  return `${count} view${count !== 1 ? 's' : ''}`;
}

export function VideoCard({ video, className }: VideoCardProps) {
  const progressPercent =
    video.progress && video.progress.duration_seconds > 0
      ? Math.min(
          (video.progress.watched_seconds / video.progress.duration_seconds) * 100,
          100
        )
      : 0;

  return (
    <Link
      href={`/watch/${video.id}`}
      className={cn(
        'flex w-40 shrink-0 snap-start flex-col gap-1.5',
        className
      )}
    >
      {/* Thumbnail */}
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

        {/* Progress bar overlay for continue watching */}
        {progressPercent > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
            <div
              className="h-full bg-primary"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <h4 className="line-clamp-2 text-xs font-medium leading-tight text-text dark:text-text-dark">
          {video.title}
        </h4>
        {video.view_count > 0 && (
          <p className="text-[10px] text-text-muted dark:text-text-muted-dark">
            {formatViewCount(video.view_count)}
          </p>
        )}
      </div>
    </Link>
  );
}
