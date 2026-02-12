'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import type { FeedMedia } from '@/hooks/useFeed';

interface MediaCarouselProps {
  media: FeedMedia[];
  /** Rounded corners on container (default true) */
  rounded?: boolean;
}

/**
 * Horizontal swipeable media carousel (like Instagram).
 * - 1 item: single image/video, no pagination dots
 * - 2+ items: horizontal scroll with snap-to-item, pagination dots
 * - Images: lazy loaded, object-fit cover
 * - Videos: poster thumbnail, autoplay muted when visible (IntersectionObserver), loop
 */
export function MediaCarousel({ media, rounded = true }: MediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const sorted = [...media].sort((a, b) => a.sort_order - b.sort_order);
  const isSingle = sorted.length === 1;

  // Track scroll position to update active index
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(index);
  }, []);

  // IntersectionObserver for video autoplay
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    videoRefs.current.forEach((video) => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              video.play().catch(() => {
                // Autoplay blocked by browser - acceptable
              });
            } else {
              video.pause();
            }
          });
        },
        { threshold: 0.5 }
      );
      observer.observe(video);
      observers.push(observer);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, [sorted.length]);

  /** Format duration seconds to m:ss */
  function formatDuration(seconds: number | null): string | null {
    if (seconds === null || seconds === undefined) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className={cn('relative w-full overflow-hidden', rounded && 'rounded-xl')}>
      <div
        ref={scrollRef}
        className={cn(
          'flex w-full overflow-x-auto scrollbar-hide',
          !isSingle && 'snap-x snap-mandatory'
        )}
        onScroll={handleScroll}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {sorted.map((item, i) => {
          const aspectRatio =
            item.width && item.height
              ? `${item.width} / ${item.height}`
              : '1 / 1';

          return (
            <div
              key={item.id}
              className={cn(
                'relative w-full shrink-0',
                !isSingle && 'snap-center'
              )}
              style={{ aspectRatio }}
            >
              {item.media_type === 'image' ? (
                <img
                  src={item.url}
                  alt={`Media ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="relative h-full w-full">
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(item.id, el);
                    }}
                    src={item.url}
                    poster={item.thumbnail_url ?? undefined}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  {/* Duration badge */}
                  {item.duration && (
                    <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
                      {formatDuration(item.duration)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination dots */}
      {!isSingle && sorted.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
          {sorted.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === activeIndex
                  ? 'w-4 bg-white'
                  : 'w-1.5 bg-white/50'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
