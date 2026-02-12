'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { FeedPost } from '@/hooks/useFeed';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { PostCard } from './PostCard';
import { EmptyFeedState } from './EmptyFeedState';
import { cn } from '@/lib/utils/cn';

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
}: PostFeedProps) {
  const { ref: sentinelRef, inView } = useInfiniteScroll();

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger load more when sentinel enters viewport
  useEffect(() => {
    if (inView && hasMore && !loading) {
      onLoadMore();
    }
  }, [inView, hasMore, loading, onLoadMore]);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (container && container.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null || refreshing) return;
      const diff = e.touches[0].clientY - touchStartY.current;
      if (diff > 0) {
        setPullDistance(Math.min(diff * 0.5, 100));
        setIsPulling(true);
      }
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 80 && !refreshing) {
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

  // TikTok mode: full-screen vertical snap
  if (feedStyle === 'tiktok') {
    return (
      <div
        ref={containerRef}
        className="h-[calc(100vh-3.5rem-4rem)] snap-y snap-mandatory overflow-y-auto"
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

        {posts.map((post) => (
          <div
            key={post.id}
            className="h-[calc(100vh-3.5rem-4rem)] w-full snap-start snap-always"
          >
            <PostCard
              post={post}
              feedStyle="tiktok"
              currentUserId={currentUserId}
              onRemovePost={onRemovePost}
              onUpdatePost={onUpdatePost}
            />
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
