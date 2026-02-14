'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { VideoData } from './VideoCard';

interface HeroVideo extends VideoData {
  video_url?: string;
  category?: { id: number; name: string; slug: string };
}

interface HeroBannerProps {
  video: HeroVideo | null;
  className?: string;
}

export function HeroBanner({ video, className }: HeroBannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.play().catch(() => {});
  }, [video?.video_url]);

  // Placeholder when no hero
  if (!video) {
    return (
      <div
        className={cn(
          'relative flex aspect-[16/9] w-full items-end overflow-hidden bg-gradient-to-br from-primary/40 via-primary/20 to-primary/5 dark:from-primary/30 dark:via-primary/10 dark:to-black',
          className
        )}
      >
        <div className="relative z-10 flex flex-col gap-1 p-5">
          <h2 className="text-2xl font-bold text-text dark:text-white">
            Video Library
          </h2>
          <p className="text-sm text-text-muted dark:text-white/60">
            Browse categories below
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative aspect-[16/9] w-full overflow-hidden bg-black',
        className
      )}
    >
      {/* Auto-play muted video */}
      {video.video_url && (
        <video
          ref={videoRef}
          src={video.video_url}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Fallback thumbnail if no video_url */}
      {!video.video_url && video.thumbnail_url && (
        <img
          src={video.thumbnail_url}
          alt={video.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Content overlay */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-5">
        {video.category && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
            {video.category.name}
          </span>
        )}
        <h2 className="line-clamp-2 text-xl font-bold leading-tight text-white drop-shadow-lg sm:text-2xl">
          {video.title}
        </h2>
        {video.description && (
          <p className="line-clamp-2 text-sm leading-snug text-white/75">
            {video.description}
          </p>
        )}
        <Link
          href={`/watch/${video.id}`}
          className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black shadow-lg transition-transform active:scale-95"
        >
          <Play className="h-4 w-4" fill="currentColor" />
          Watch Now
        </Link>
      </div>
    </div>
  );
}
