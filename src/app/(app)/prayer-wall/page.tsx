'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Heart, Loader2, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePrayerWall } from '@/hooks/usePrayerWall';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { PrayerCard } from '@/components/prayer/PrayerCard';
import { PrayerTabs } from '@/components/prayer/PrayerTabs';
import { PrayerFilters } from '@/components/prayer/PrayerFilters';
import { PrayerComposer } from '@/components/prayer/PrayerComposer';
import { EmptyState } from '@/components/common/EmptyState';
import type { PrayerItem } from '@/hooks/usePrayerWall';

/** Per-card stagger delay in ms */
const CARD_STAGGER_MS = 80;

export default function PrayerWallPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);

  // Auto-open composer when navigated from center + nav button, then clear the param
  useEffect(() => {
    if (searchParams.get('compose') === 'prayer_request') {
      setComposerOpen(true);
      router.replace('/prayer-wall', { scroll: false });
    }
  }, [searchParams, router]);

  const {
    prayers,
    loading,
    refreshing,
    hasMore,
    activeTab,
    statusFilter,
    setActiveTab,
    setStatusFilter,
    fetchNextPage,
    refresh,
    onPrayerCreated,
    removePrayer,
    updatePrayer,
  } = usePrayerWall();

  const { ref: scrollRef, inView } = useInfiniteScroll();

  // Infinite scroll trigger
  useEffect(() => {
    if (inView && hasMore && !loading) {
      fetchNextPage();
    }
  }, [inView, hasMore, loading, fetchNextPage]);

  const handlePrayerUpdate = useCallback(
    (id: number, updates: Partial<PrayerItem>) => {
      updatePrayer(id, updates);
    },
    [updatePrayer]
  );

  const handleDelete = useCallback(
    (id: number) => {
      removePrayer(id);
    },
    [removePrayer]
  );

  const handleComposerSubmit = useCallback(() => {
    onPrayerCreated();
  }, [onPrayerCreated]);

  // Fade-in after data + images are ready
  const [contentReady, setContentReady] = useState(false);
  // Track how many cards were already visible (so infinite-scroll appends don't re-animate)
  const revealedCountRef = useRef(0);

  useEffect(() => {
    // Reset when loading starts on a fresh fetch (tab/filter change)
    if (loading && prayers.length === 0) {
      setContentReady(false);
      revealedCountRef.current = 0;
      return;
    }

    // Still loading initial batch — keep showing spinner
    if (loading) return;

    // No prayers = nothing to preload, show empty state
    if (prayers.length === 0) {
      setContentReady(true);
      return;
    }

    // Already revealed — infinite scroll appended cards, no need to re-preload
    if (contentReady) {
      return;
    }

    // Collect image URLs from the initial page of prayers
    const urls: string[] = [];
    for (const prayer of prayers) {
      const author = prayer.post.user;
      if (!prayer.post.is_anonymous && author.avatar_url) {
        urls.push(author.avatar_url);
      }
      for (const m of prayer.post.media) {
        if (m.media_type === 'image') {
          urls.push(m.url);
        }
      }
    }

    const uniqueUrls = [...new Set(urls)];

    if (uniqueUrls.length === 0) {
      setContentReady(true);
      return;
    }

    let settled = 0;
    const total = uniqueUrls.length;
    let cancelled = false;

    for (const url of uniqueUrls) {
      const img = new Image();
      const onDone = () => {
        if (cancelled) return;
        settled++;
        if (settled >= total) {
          setContentReady(true);
        }
      };
      img.onload = onDone;
      img.onerror = onDone;
      img.src = url;
    }

    // Safety timeout — show content after 3s even if images are slow
    const timer = setTimeout(() => {
      if (!cancelled) {
        setContentReady(true);
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, prayers.length, contentReady]);

  // After new cards render from infinite scroll, mark them as revealed
  // so they only animate once
  useEffect(() => {
    if (contentReady && prayers.length > revealedCountRef.current) {
      // Wait for the animation to complete before marking as revealed
      const newCards = prayers.length - revealedCountRef.current;
      const totalAnimTime = newCards * CARD_STAGGER_MS + 400;
      const timer = setTimeout(() => {
        revealedCountRef.current = prayers.length;
      }, totalAnimTime);
      return () => clearTimeout(timer);
    }
  }, [contentReady, prayers.length]);

  // Reset fade state when tab or filter changes
  useEffect(() => {
    setContentReady(false);
    revealedCountRef.current = 0;
  }, [activeTab, statusFilter]);

  // Pull-to-refresh (touch-based)
  const [pullStartY, setPullStartY] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (scrollTop <= 0) {
      setPullStartY(e.touches[0].clientY);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (pullStartY === null) return;
      const diff = e.touches[0].clientY - pullStartY;
      if (diff > 0) {
        setPullDistance(Math.min(diff * 0.5, 80));
      }
    },
    [pullStartY]
  );

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 50) {
      refresh();
    }
    setPullStartY(null);
    setPullDistance(0);
  }, [pullDistance, refresh]);

  // Bible-mode gate
  if (user?.mode === 'positivity') {
    return (
      <div className="flex min-h-[calc(100vh-7.5rem)] items-center justify-center px-4">
        <div className="text-center">
          <Heart className="mx-auto h-16 w-16 text-text-muted/30 dark:text-white/20" />
          <h2 className="mt-4 text-lg font-semibold text-text dark:text-white/80">
            Prayer Wall
          </h2>
          <p className="mt-2 max-w-sm text-sm text-text-muted dark:text-white/50">
            The prayer wall is available in Bible mode. Switch to Bible mode in Settings to access prayer requests.
          </p>
          <a
            href="/settings"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-surface-dark/5 px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-dark/10 hover:text-text dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15 dark:hover:text-white"
          >
            <Settings className="h-4 w-4" />
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  // Empty state messages per tab
  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'others':
        return {
          title: 'No prayer requests yet',
          description: 'Be the first to share a prayer request with the community!',
        };
      case 'my_requests':
        return {
          title: "You haven't shared any prayer requests yet",
          description: 'Tap the + button to create your first prayer request.',
        };
      case 'my_joined':
        return {
          title: "You haven't joined any prayers yet",
          description: "Tap the 🙏 reaction on someone's request to join in prayer.",
        };
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-7.5rem)] px-4 py-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center transition-all"
          style={{ height: pullDistance }}
        >
          <Loader2
            className="h-5 w-5 animate-spin text-text-muted/40 dark:text-white/40"
            style={{ opacity: pullDistance / 80 }}
          />
        </div>
      )}

      {/* Refreshing indicator */}
      {refreshing && (
        <div className="mb-3 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted/40 dark:text-white/40" />
        </div>
      )}

      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text dark:text-white">Prayer Wall</h1>
      </div>

      {/* Tabs */}
      <div className="mb-3">
        <PrayerTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Filters */}
      <div className="mb-4">
        <PrayerFilters statusFilter={statusFilter} onFilterChange={setStatusFilter} />
      </div>

      {/* Prayer list */}
      {(loading && prayers.length === 0) || !contentReady ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary/60" />
        </div>
      ) : prayers.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-12 w-12" />}
          title={getEmptyMessage().title}
          description={getEmptyMessage().description}
          className="min-h-[40vh]"
        />
      ) : (
        <div className="space-y-4">
          {prayers.map((prayer, i) => {
            const alreadyRevealed = i < revealedCountRef.current;
            return (
              <div
                key={prayer.id}
                style={alreadyRevealed ? undefined : {
                  opacity: 0,
                  animation: `fadeInUp 400ms ease-out ${(i - revealedCountRef.current) * CARD_STAGGER_MS}ms forwards`,
                }}
              >
                <PrayerCard
                  prayer={prayer}
                  currentUserId={user?.id ?? 0}
                  onPrayerUpdate={handlePrayerUpdate}
                  onDelete={handleDelete}
                />
              </div>
            );
          })}

          {/* Infinite scroll sentinel */}
          <div ref={scrollRef} className="h-1" />

          {/* Loading more indicator */}
          {loading && prayers.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted/40 dark:text-white/40" />
            </div>
          )}
        </div>
      )}

      {/* Prayer composer */}
      <PrayerComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleComposerSubmit}
      />
    </div>
  );
}
