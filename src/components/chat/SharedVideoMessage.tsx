'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SharedVideoData {
  id: number;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
}

interface SharedVideoMessageProps {
  video: SharedVideoData;
  className?: string;
}

/** Format seconds into M:SS or H:MM:SS */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Card-style preview of a shared video inside a chat message bubble.
 * Shows thumbnail (16:9), play icon overlay, title, and duration badge.
 * Tappable to navigate to /watch/[id].
 */
export function SharedVideoMessage({ video, className }: SharedVideoMessageProps) {
  return (
    <Link
      href={`/watch/${video.id}`}
      className={cn(
        'block overflow-hidden rounded-xl border border-white/20 dark:border-white/10',
        'bg-white/5 backdrop-blur-sm transition-colors active:bg-white/10',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Thumbnail with play overlay */}
      <div className="relative aspect-video w-full bg-black/20">
        {video.thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt={video.title}
            fill
            className="object-cover"
            sizes="280px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <Play className="h-8 w-8 text-white/40" />
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
            <Play className="h-4 w-4 translate-x-0.5 text-white" fill="currentColor" />
          </div>
        </div>

        {/* Duration badge */}
        {video.duration_seconds > 0 && (
          <div className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {formatDuration(video.duration_seconds)}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="p-2.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-white/90 dark:text-white/90">
          {video.title}
        </p>
      </div>
    </Link>
  );
}
