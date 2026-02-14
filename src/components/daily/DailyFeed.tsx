'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useDailyFeed } from '@/hooks/useDailyFeed';
import { DailyPostCarousel } from './DailyPostCarousel';
import { useDailyTranslation } from '@/context/DailyTranslationContext';
import { cn } from '@/lib/utils/cn';

function getScrollContainer() {
  return document.getElementById('immersive-scroll');
}

export function DailyFeed() {
  const { days, loading, refreshing, hasMore, fetchNextPage, refresh } = useDailyFeed();
  const dailyTranslation = useDailyTranslation();

  // Register available translations from first loaded day
  useEffect(() => {
    if (days.length === 0 || !dailyTranslation) return;
    const first = days[0];
    const codes = first.translations.map((t) => t.code);
    dailyTranslation.registerTranslations(codes, first.translation_names);
  }, [days, dailyTranslation]);

  // Scroll to top on mount
  useEffect(() => {
    getScrollContainer()?.scrollTo(0, 0);
  }, []);

  const [activeIndex, setActiveIndex] = useState(0);
  const preloadTriggeredRef = useRef(false);

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef<number | null>(null);

  // Track active card via container scroll position
  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    const handleScroll = () => {
      const cardHeight = container.clientHeight;
      if (cardHeight === 0) return;
      const index = Math.round(container.scrollTop / cardHeight);
      setActiveIndex(index);

      // Preload next batch when 3 items from end
      const threshold = days.length - 3;
      if (index >= threshold && hasMore && !loading && !preloadTriggeredRef.current) {
        preloadTriggeredRef.current = true;
        fetchNextPage();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [days.length, hasMore, loading, fetchNextPage]);

  // Reset preload trigger when days change
  useEffect(() => {
    preloadTriggeredRef.current = false;
  }, [days.length]);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = getScrollContainer();
    if (container && container.scrollTop <= 1) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null || refreshing) return;
      const diff = e.touches[0].clientY - touchStartY.current;
      if (diff > 10) {
        setPullDistance(Math.min(diff * 0.5, 100));
        setIsPulling(true);
      }
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 60 && !refreshing) {
      refresh();
    }
    setPullDistance(0);
    setIsPulling(false);
    touchStartY.current = null;
  }, [pullDistance, refreshing, refresh]);

  // Initial loading state
  if (loading && days.length === 0) {
    return (
      <div className="flex items-center justify-center bg-[#0a0a0f]" style={{ height: '100svh' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  // Empty state
  if (!loading && days.length === 0) {
    return (
      <div className="flex items-center justify-center bg-[#0a0a0f]" style={{ height: '100svh' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div
      className="bg-[#0a0a0f]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {isPulling && (
        <div
          className="flex items-center justify-center"
          style={{ height: pullDistance }}
        >
          <div
            className={cn(
              'h-6 w-6 rounded-full border-2 border-white/20 border-t-white',
              pullDistance > 80 ? 'animate-spin' : ''
            )}
            style={{ transform: `rotate(${pullDistance * 3.6}deg)` }}
          />
        </div>
      )}

      {refreshing && (
        <div className="flex items-center justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {days.map((day, index) => (
        <div
          key={day.id}
          className="w-full snap-start snap-always"
          style={{ height: '100svh' }}
        >
          {Math.abs(index - activeIndex) <= 1 ? (
            <DailyPostCarousel
              prefetchedContent={day}
              isActive={index === activeIndex}
              feedMode
            />
          ) : (
            <div className="h-full w-full bg-[#0a0a0f]" />
          )}
        </div>
      ))}

      {/* Loading more indicator */}
      {loading && days.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}
    </div>
  );
}
