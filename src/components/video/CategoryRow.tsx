'use client';

import { useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { VideoCard, type VideoData } from './VideoCard';

interface CategoryRowProps {
  name: string;
  slug?: string;
  videos: VideoData[];
  className?: string;
}

export function CategoryRow({ name, slug, videos, className }: CategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollRight = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  }, []);

  if (videos.length === 0) return null;

  const seeAllHref = slug ? `/watch/category/${slug}` : '/watch/category/all';

  return (
    <section className={cn('flex flex-col gap-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        <h3 className="text-base font-semibold text-text dark:text-text-dark">
          {name}
        </h3>
        {videos.length > 2 && (
          <Link
            href={seeAllHref}
            className="flex items-center gap-0.5 text-xs font-medium text-primary"
          >
            See All
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className={cn(
          'flex gap-3 overflow-x-auto px-4 pb-1',
          'scrollbar-none',
          '[scroll-snap-type:x_mandatory]',
          '[-webkit-overflow-scrolling:touch]'
        )}
      >
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}
