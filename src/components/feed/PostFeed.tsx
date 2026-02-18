'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import type { FeedPost } from '@/hooks/useFeed';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { PostCard } from './PostCard';
import { EmptyFeedState } from './EmptyFeedState';
import { cn } from '@/lib/utils/cn';

function getScrollContainer() {
  return document.getElementById('immersive-scroll');
}

interface PostFeedProps {
  posts: FeedPost[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  feedStyle: 'tiktok' | 'instagram';
  refreshing: boolean;
  onRefresh: () => void;
  currentUserId: number | null;
  onRemovePost?: (postId: number) => void;
  onUpdatePost?: (postId: number, updates: Partial<FeedPost>) => void;
  /** Ref tracking how many items were trimmed from front (TikTok mode scroll adjustment) */
  frontTrimRef?: React.MutableRefObject<number>;
}

/**
 * Post feed list with infinite scroll, pull-to-refresh, and dual display mode.
 * TikTok: vertical scroll with snap, full-screen cards
 * Instagram: standard vertical scroll with card gaps
 */
export function PostFeed({
  posts,
  loading,
  hasMore,
  onLoadMore,
  feedStyle,
  refreshing,
  onRefresh,
  currentUserId,
  onRemovePost,
  onUpdatePost,
  frontTrimRef,
}: PostFeedProps) {
  const { ref: sentinelRef, inView } = useInfiniteScroll();

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const preloadTriggeredRef = useRef(false);

  // Trigger load more when sentinel enters viewport (Instagram mode)
  useEffect(() => {
    if (inView && hasMore && !loading) {
      onLoadMore();
    }
  }, [inView, hasMore, loading, onLoadMore]);

  // TikTok mode: restore scroll position on mount (or start at top for fresh visits)
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    if (feedStyle !== 'tiktok' || scrollRestoredRef.current || posts.length === 0) return;
    scrollRestoredRef.current = true;
    const saved = sessionStorage.getItem('feed_scroll');
    const container = getScrollContainer();
    if (saved && container) {
      sessionStorage.removeItem('feed_scroll');
      // Defer to next frame so posts are rendered with correct heights
      requestAnimationFrame(() => container.scrollTo(0, parseInt(saved, 10)));
    } else {
      container?.scrollTo(0, 0);
    }
  }, [feedStyle, posts.length]);

  // TikTok mode: track active card index for virtualization + preloading
  const [tiktokActiveIndex, setTiktokActiveIndex] = useState(0);

  useEffect(() => {
    if (feedStyle !== 'tiktok') return;

    const container = getScrollContainer();
    if (!container) return;

    const handleScroll = () => {
      const cardHeight = container.clientHeight;
      if (cardHeight === 0) return;
      const currentIndex = Math.round(container.scrollTop / cardHeight);
      setTiktokActiveIndex(currentIndex);

      // Preload next batch when 5 posts from end
      const threshold = posts.length - 5;
      if (currentIndex >= threshold && hasMore && !loading && !preloadTriggeredRef.current) {
        preloadTriggeredRef.current = true;
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [feedStyle, posts.length, hasMore, loading, onLoadMore]);

  // Reset preload trigger when posts change (new batch loaded)
  useEffect(() => {
    preloadTriggeredRef.current = false;
  }, [posts.length]);

  // Adjust scroll position when sliding window trims items from front (TikTok mode)
  useLayoutEffect(() => {
    if (!frontTrimRef || feedStyle !== 'tiktok') return;
    const trimCount = frontTrimRef.current;
    if (trimCount > 0) {
      frontTrimRef.current = 0;
      const container = getScrollContainer();
      if (container) {
        const cardHeight = container.clientHeight;
        container.scrollTop -= trimCount * cardHeight;
      }
      setTiktokActiveIndex((prev) => Math.max(0, prev - trimCount));
    }
  }, [posts, frontTrimRef, feedStyle]);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (feedStyle === 'tiktok') {
      const container = getScrollContainer();
      if (container && container.scrollTop <= 1) {
        touchStartY.current = e.touches[0].clientY;
      }
    } else {
      const container = containerRef.current;
      if (container && container.scrollTop <= 1) {
        touchStartY.current = e.touches[0].clientY;
      }
    }
  }, [feedStyle]);

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
      onRefresh();
    }
    setPullDistance(0);
    setIsPulling(false);
    touchStartY.current = null;
  }, [pullDistance, refreshing, onRefresh]);

  // Empty state
  if (!loading && posts.length === 0) {
    return <EmptyFeedState />;
  }

  // TikTok mode: cards scroll inside #immersive-scroll container
  if (feedStyle === 'tiktok') {
    return (
      <div
        className="bg-black"
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
              style={{
                transform: `rotate(${pullDistance * 3.6}deg)`,
              }}
            />
          </div>
        )}

        {refreshing && (
          <div className="flex items-center justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          </div>
        )}

        {posts.map((post, index) => (
          <div
            key={post.id}
            className="w-full snap-start snap-always"
            style={{ height: '100svh' }}
          >
            {Math.abs(index - tiktokActiveIndex) <= 3 ? (
              <PostCard
                post={post}
                feedStyle="tiktok"
                currentUserId={currentUserId}
                onRemovePost={onRemovePost}
                onUpdatePost={onUpdatePost}
              />
            ) : (
              <div className="h-full w-full bg-black" />
            )}
          </div>
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {/* Loading more */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        )}
      </div>
    );
  }

  // Instagram mode: standard scroll with card gaps
  return (
    <div
      ref={containerRef}
      className="min-h-[calc(100vh-7.5rem)]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {isPulling && (
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ height: pullDistance }}
        >
          <div
            className={cn(
              'h-6 w-6 rounded-full border-2 border-primary/20 border-t-primary',
              pullDistance > 80 ? 'animate-spin' : ''
            )}
            style={{
              transform: `rotate(${pullDistance * 3.6}deg)`,
            }}
          />
        </div>
      )}

      {refreshing && (
        <div className="flex items-center justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      )}

      <div className="space-y-4 px-4 py-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            feedStyle="instagram"
            currentUserId={currentUserId}
            onRemovePost={onRemovePost}
            onUpdatePost={onUpdatePost}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {/* Loading more */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      )}
    </div>
  );
}
