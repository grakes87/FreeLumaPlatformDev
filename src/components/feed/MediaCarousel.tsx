'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { FeedMedia } from '@/hooks/useFeed';

interface MediaCarouselProps {
  media: FeedMedia[];
  /** Rounded corners on container (default true) */
  rounded?: boolean;
  /** Override aspect ratio for all items (e.g. '4 / 5') */
  aspectRatio?: string;
}

/** Format duration seconds to m:ss */
function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---- Video item with loading spinner + play/pause overlay ----

function VideoItem({
  item,
  onVideoRef,
}: {
  item: FeedMedia;
  onVideoRef: (id: number, el: HTMLVideoElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [paused, setPaused] = useState(true);

  const handlePlaying = useCallback(() => {
    setVideoLoading(false);
    setPaused(false);
  }, []);

  const handlePause = useCallback(() => {
    setPaused(true);
  }, []);

  const handleWaiting = useCallback(() => {
    setVideoLoading(true);
  }, []);

  const handleCanPlayThrough = useCallback(() => {
    setVideoLoading(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={(el) => {
          (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
          onVideoRef(item.id, el);
        }}
        src={item.url}
        poster={item.thumbnail_url ?? undefined}
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        onPlaying={handlePlaying}
        onPause={handlePause}
        onWaiting={handleWaiting}
        onCanPlayThrough={handleCanPlayThrough}
      />

      {/* Centered loading spinner — visible until video starts playing */}
      {videoLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        </div>
      )}

      {/* Tap-to-toggle play/pause overlay */}
      <button
        type="button"
        onClick={togglePlayPause}
        className="absolute inset-0 z-10"
        aria-label={paused ? 'Play video' : 'Pause video'}
      />

      {/* Play icon — shown while paused, immediately removed on play */}
      {paused && !videoLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/40 p-4 backdrop-blur-sm">
            <Play className="h-8 w-8 text-white" fill="white" />
          </div>
        </div>
      )}

      {/* Duration badge */}
      {item.duration && (
        <span className="absolute right-2 bottom-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(item.duration)}
        </span>
      )}
    </div>
  );
}

/**
 * Horizontal swipeable media carousel (like Instagram).
 * - 1 item: single image/video, no pagination dots
 * - 2+ items: horizontal scroll with snap-to-item, pagination dots
 * - Images: lazy loaded, object-fit cover
 * - Videos: poster thumbnail, autoplay muted when visible (IntersectionObserver), loop
 */
export function MediaCarousel({ media, rounded = true, aspectRatio: aspectRatioOverride }: MediaCarouselProps) {
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

  const handleVideoRef = useCallback((id: number, el: HTMLVideoElement | null) => {
    if (el) {
      videoRefs.current.set(id, el);
    } else {
      videoRefs.current.delete(id);
    }
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
          const aspectRatio = aspectRatioOverride
            ?? (item.width && item.height
              ? `${item.width} / ${item.height}`
              : '1 / 1');

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
                <VideoItem item={item} onVideoRef={handleVideoRef} />
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
