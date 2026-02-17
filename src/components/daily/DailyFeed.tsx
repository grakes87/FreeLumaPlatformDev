'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useDailyFeed } from '@/hooks/useDailyFeed';
import { DailyPostCarousel } from './DailyPostCarousel';
import { useDailyTranslation } from '@/context/DailyTranslationContext';
import { useAuth } from '@/hooks/useAuth';
import type { VerseMode } from './VerseModeToggle';
import { VerseByCategorySlide } from './VerseByCategorySlide';
import { CategorySelector } from './CategorySelector';
import { useVerseByCategoryFeed } from '@/hooks/useVerseByCategoryFeed';
import { cn } from '@/lib/utils/cn';

function getScrollContainer() {
  return document.getElementById('immersive-scroll');
}

export function DailyFeed({ mode }: { mode?: string } = {}) {
  const { days, loading, refreshing, hasMore, fetchNextPage, refresh, frontTrimRef } = useDailyFeed(mode);
  const dailyTranslation = useDailyTranslation();
  const { user, refreshUser } = useAuth();

  // Verse mode state -- only relevant for bible-mode users
  const isBibleMode = user?.mode === 'bible';
  const [verseMode, setVerseMode] = useState<VerseMode>(
    (isBibleMode && user?.verse_mode === 'verse_by_category') ? 'verse_by_category' : 'daily_verse'
  );

  // Sync verseMode if user data loads after mount
  useEffect(() => {
    if (isBibleMode && user?.verse_mode) {
      setVerseMode(user.verse_mode);
    }
  }, [isBibleMode, user?.verse_mode]);

  // Verse-by-category hook (only active when in that mode)
  const verseFeed = useVerseByCategoryFeed();

  // Category selector collapsed state
  const [categorySelectorCollapsed, setCategorySelectorCollapsed] = useState(true);

  // Listen for verse mode changes from TopBar circle toggle
  useEffect(() => {
    const handler = (e: Event) => {
      const newMode = (e as CustomEvent<VerseMode>).detail;
      setVerseMode(newMode);
      refreshUser();
    };
    window.addEventListener('verse-mode-change', handler);
    return () => window.removeEventListener('verse-mode-change', handler);
  }, [refreshUser]);

  const handleCategorySelect = useCallback((id: number | 'all') => {
    verseFeed.selectCategory(id);
    setCategorySelectorCollapsed(true);
  }, [verseFeed]);

  // Register available translations from first loaded day
  useEffect(() => {
    if (days.length === 0 || !dailyTranslation) return;
    const first = days[0];
    const codes = first.translations.map((t) => t.code);
    dailyTranslation.registerTranslations(codes, first.translation_names);
  }, [days, dailyTranslation]);

  // Also register translations from verse-by-category content
  useEffect(() => {
    if (!dailyTranslation || !verseFeed.verse || verseMode !== 'verse_by_category') return;
    const translations = verseFeed.verse.translations;
    if (translations.length === 0) return;
    const codes = translations.map((t) => t.translation_code.toUpperCase());
    const names: Record<string, string> = {};
    for (const t of translations) {
      names[t.translation_code.toUpperCase()] = t.translation_code.toUpperCase();
    }
    dailyTranslation.registerTranslations(codes, names);
  }, [dailyTranslation, verseFeed.verse, verseMode]);

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

  // Adjust scroll position when sliding window trims items from front
  useLayoutEffect(() => {
    const trimCount = frontTrimRef.current;
    if (trimCount > 0) {
      frontTrimRef.current = 0;
      const container = getScrollContainer();
      if (container) {
        const cardHeight = container.clientHeight;
        container.scrollTop -= trimCount * cardHeight;
      }
      setActiveIndex((prev) => Math.max(0, prev - trimCount));
    }
  }, [days, frontTrimRef]);

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

  // Determine what to show
  const showVerseModeToggle = isBibleMode;
  const showVerseByCategory = isBibleMode && verseMode === 'verse_by_category';

  // Toggle scroll snap on the container based on mode
  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;
    if (showVerseByCategory) {
      container.style.scrollSnapType = 'none';
      container.style.overflowY = 'hidden';
    } else {
      container.style.scrollSnapType = 'y mandatory';
      container.style.overflowY = 'auto';
    }
    return () => {
      container.style.scrollSnapType = 'y mandatory';
      container.style.overflowY = 'auto';
    };
  }, [showVerseByCategory]);

  // Initial loading state
  if (loading && days.length === 0 && !showVerseByCategory) {
    return (
      <div className="flex items-center justify-center bg-[#0a0a0f]" style={{ height: '100svh' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  // Empty state (daily verse mode)
  if (!loading && days.length === 0 && !showVerseByCategory) {
    return (
      <div className="flex items-center justify-center bg-[#0a0a0f]" style={{ height: '100svh' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0f] relative">
      {/* VerseModeToggle is now rendered in TopBar, not here */}

      {/* Daily Verse mode (standard DailyFeed scroll) */}
      <div
        className={cn(
          'transition-opacity duration-300',
          showVerseByCategory ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100'
        )}
      >
        <div
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
      </div>

      {/* Verse by Category mode */}
      <div
        className={cn(
          'transition-opacity duration-300',
          showVerseByCategory ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
        )}
      >
        {showVerseByCategory && (
          <div className="relative" style={{ height: '100svh' }}>
            {/* Category selector (floating overlay) */}
            <CategorySelector
              categories={verseFeed.categories}
              activeCategoryId={verseFeed.activeCategoryId}
              onSelect={handleCategorySelect}
              collapsed={categorySelectorCollapsed}
              onToggle={() => setCategorySelectorCollapsed((v) => !v)}
            />

            {/* Verse slide content */}
            {verseFeed.loading && !verseFeed.verse ? (
              <div className="flex h-full items-center justify-center bg-[#0a0a0f]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            ) : verseFeed.error ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0a0a0f] px-6">
                <p className="text-center text-sm text-white/60">{verseFeed.error}</p>
                <button
                  type="button"
                  onClick={() => verseFeed.fetchVerse(verseFeed.activeCategoryId)}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-xl transition-colors hover:bg-white/20"
                >
                  Try Again
                </button>
              </div>
            ) : verseFeed.verse ? (
              <VerseByCategorySlide
                verse={verseFeed.verse}
                backgroundUrl={verseFeed.backgroundUrl}
                initialUserReaction={verseFeed.userReaction}
                initialReactionCounts={verseFeed.reactionCounts}
                initialReactionTotal={verseFeed.reactionTotal}
                initialCommentCount={verseFeed.commentCount}
                activeTranslation={dailyTranslation?.activeTranslation ?? null}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
