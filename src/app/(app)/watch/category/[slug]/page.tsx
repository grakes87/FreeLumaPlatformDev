'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { VideoCard, type VideoData } from '@/components/video/VideoCard';

interface CategoryInfo {
  id: number;
  name: string;
  slug: string;
}

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const isAll = slug === 'all';

  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve slug to category_id (skip for "all")
  const resolveCategoryId = useCallback(async (): Promise<string | null> => {
    if (isAll) return 'uncategorized';

    const res = await fetch('/api/video-categories');
    if (!res.ok) return null;

    const json = await res.json();
    const cats: CategoryInfo[] = (json.data ?? json).categories || [];
    const match = cats.find((c) => c.slug === slug);
    if (match) {
      setCategory(match);
      return String(match.id);
    }
    return null;
  }, [slug, isAll]);

  const fetchVideos = useCallback(async (categoryIdParam: string, cursor?: number | null) => {
    const params = new URLSearchParams({
      category_id: categoryIdParam,
      limit: '20',
    });
    if (cursor) params.set('cursor', String(cursor));

    const res = await fetch(`/api/videos?${params}`);
    if (!res.ok) throw new Error('Failed to fetch videos');

    const json = await res.json();
    const d = json.data ?? json;
    return {
      videos: (d.videos || []) as VideoData[],
      next_cursor: d.next_cursor as number | null,
      has_more: d.has_more as boolean,
    };
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const catId = await resolveCategoryId();
        if (cancelled) return;

        if (!catId) {
          setError('Category not found');
          setLoading(false);
          return;
        }

        const result = await fetchVideos(catId);
        if (cancelled) return;

        setVideos(result.videos);
        setNextCursor(result.next_cursor);
        setHasMore(result.has_more);
      } catch {
        if (!cancelled) setError('Failed to load videos');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [resolveCategoryId, fetchVideos]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const catId = isAll ? 'uncategorized' : category ? String(category.id) : null;
      if (!catId) return;

      const result = await fetchVideos(catId, nextCursor);
      setVideos((prev) => [...prev, ...result.videos]);
      setNextCursor(result.next_cursor);
      setHasMore(result.has_more);
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, nextCursor, loadingMore, isAll, category, fetchVideos]);

  const title = isAll ? 'All Videos' : category?.name || '';

  if (loading) return <CategoryGridSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-sm text-text-muted dark:text-text-muted-dark">{error}</p>
        <Link
          href="/watch"
          className="mt-4 text-sm font-medium text-primary"
        >
          Back to Watch
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3">
        <Link
          href="/watch"
          className="flex h-8 w-8 items-center justify-center rounded-full text-text dark:text-text-dark"
          aria-label="Back to Watch"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold text-text dark:text-text-dark">
          {title}
        </h1>
      </div>

      {/* Video Grid */}
      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            No videos in this category yet.
          </p>
        </div>
      ) : (
        <div className={cn(
          'grid gap-3 px-4',
          'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5'
        )}>
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              className="w-full"
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center px-4 py-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className={cn(
              'rounded-full px-6 py-2 text-sm font-medium',
              'bg-primary/10 text-primary',
              'disabled:opacity-50'
            )}
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryGridSkeleton() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-4 pt-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="h-6 w-36 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="aspect-video w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
