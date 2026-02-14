'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { HeroBanner } from '@/components/video/HeroBanner';
import { CategoryRow } from '@/components/video/CategoryRow';
import { Top10Row } from '@/components/video/Top10Row';
import type { VideoData } from '@/components/video/VideoCard';

interface CategoryData {
  id: number;
  name: string;
  slug: string;
  videos: VideoData[];
}

interface HeroVideo extends VideoData {
  video_url?: string;
  category?: { id: number; name: string; slug: string };
}

export default function WatchPage() {
  const [heroVideo, setHeroVideo] = useState<HeroVideo | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [continueWatching, setContinueWatching] = useState<VideoData[]>([]);
  const [top10, setTop10] = useState<VideoData[]>([]);
  const [uncategorized, setUncategorized] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [videosRes, heroRes] = await Promise.all([
        fetch('/api/videos'),
        fetch('/api/videos/hero'),
      ]);

      // Parse videos
      if (videosRes.ok) {
        const json = await videosRes.json();
        // successResponse returns data directly (not wrapped in .data)
        const d = json.data ?? json;
        setCategories(d.categories || []);
        setContinueWatching(d.continue_watching || []);
        setTop10(d.top_10 || []);
        setUncategorized(d.uncategorized || []);
      }

      // Parse hero (204 = no hero)
      if (heroRes.ok && heroRes.status !== 204) {
        const json = await heroRes.json();
        const d = json.data ?? json;
        if (d.video) {
          setHeroVideo(d.video);
        }
      }
    } catch {
      // Silently fail — skeletons will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <WatchSkeleton />;
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Hero Banner */}
      <HeroBanner video={heroVideo} />

      {/* Top 10 Most Watched */}
      {top10.length > 0 && <Top10Row videos={top10} />}

      {/* Continue Watching row */}
      {continueWatching.length > 0 && (
        <CategoryRow
          name="Continue Watching"
          videos={continueWatching}
        />
      )}

      {/* Category rows */}
      {categories.map((cat) => (
        <CategoryRow
          key={cat.id}
          name={cat.name}
          slug={cat.slug}
          videos={cat.videos}
        />
      ))}

      {/* Uncategorized videos */}
      {uncategorized.length > 0 && (
        <CategoryRow name="More Videos" videos={uncategorized} />
      )}

      {/* Empty state if no content at all */}
      {categories.length === 0 && continueWatching.length === 0 && top10.length === 0 && uncategorized.length === 0 && !heroVideo && (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <svg
            className="mb-4 h-12 w-12 text-text-muted dark:text-text-muted-dark"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 0A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v12.75M18 19.5h1.5m-1.5 0a1.125 1.125 0 01-1.125-1.125M18 19.5h-1.5m2.625-1.125V5.625m0 0h-15m15 0v3.75m-15-3.75v3.75m0 0h15m-15 0v3.75m15-3.75v3.75m0 0H3.375m15 0v3.75m-15-3.75v3.75"
            />
          </svg>
          <h3 className="text-lg font-semibold text-text dark:text-text-dark">
            No Videos Yet
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-text-muted dark:text-text-muted-dark">
            Videos will appear here once content is added.
          </p>
        </div>
      )}
    </div>
  );
}

/** Skeleton loading state */
function WatchSkeleton() {
  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Hero skeleton */}
      <div className="aspect-[16/9] w-full animate-pulse bg-gray-200 dark:bg-gray-800" />

      {/* Row skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="mx-4 h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="flex gap-3 px-4">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex w-40 shrink-0 flex-col gap-1.5">
                <div className="aspect-video w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
                <div className="h-3 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
