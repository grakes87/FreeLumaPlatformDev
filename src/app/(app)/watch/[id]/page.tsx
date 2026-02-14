'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Eye, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { VideoReactionBar } from '@/components/video/VideoReactionBar';
import { ShareVideoButton } from '@/components/video/ShareVideoButton';
import type { ReactionType } from '@/lib/utils/constants';

interface VideoDetail {
  id: number;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string;
  caption_url: string | null;
  duration_seconds: number;
  view_count: number;
  published: boolean;
  category: { id: number; name: string; slug: string } | null;
  progress: {
    watched_seconds: number;
    last_position: number;
    duration_seconds: number;
    completed: boolean;
  } | null;
  user_reaction: ReactionType | null;
  reaction_counts: Record<string, number>;
  total_reactions: number;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

export default function VideoDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);

  const fetchVideo = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${params.id}`, {
        credentials: 'include',
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      setVideo(json.data ?? json);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  // Loading skeleton
  if (loading) {
    return <VideoDetailSkeleton />;
  }

  // 404
  if (notFound || !video) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-white/10">
          <Play className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-text dark:text-text-dark">
          Video Not Found
        </h2>
        <p className="mt-1.5 text-sm text-text-muted dark:text-text-muted-dark">
          This video may have been removed or is unavailable.
        </p>
        <button
          type="button"
          onClick={() => router.push('/watch')}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-white"
        >
          Browse Videos
        </button>
      </div>
    );
  }

  const descriptionLong = (video.description?.length ?? 0) > 150;
  const progressPercent =
    video.progress && video.progress.duration_seconds > 0
      ? Math.min(
          (video.progress.watched_seconds / video.progress.duration_seconds) * 100,
          100
        )
      : 0;

  return (
    <>
      <div className="flex flex-col pb-8">
        {/* Back button */}
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => router.push('/watch')}
            className="flex items-center gap-1 text-sm text-text-muted dark:text-text-muted-dark"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </button>
        </div>

        {/* Thumbnail with play button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPlayerOpen(true)}
            className="relative w-full overflow-hidden focus:outline-none"
          >
            {video.thumbnail_url ? (
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10 dark:from-primary/20 dark:to-primary/5">
                <Play className="h-16 w-16 text-primary/50" />
              </div>
            )}

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg dark:bg-black/70">
                <Play className="h-8 w-8 text-primary" fill="currentColor" />
              </div>
            </div>

            {/* Duration badge */}
            {video.duration_seconds > 0 && (
              <span className="absolute bottom-3 right-3 rounded bg-black/75 px-2 py-1 text-xs font-medium text-white">
                {formatDuration(video.duration_seconds)}
              </span>
            )}

            {/* Progress bar */}
            {progressPercent > 0 && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </button>
        </div>

        {/* Content area */}
        <div className="flex flex-col gap-4 px-4 pt-4">
          {/* Title + Category badge */}
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold leading-tight text-text dark:text-text-dark">
              {video.title}
            </h1>
            {video.category && (
              <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary dark:bg-primary/20">
                {video.category.name}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-sm text-text-muted dark:text-text-muted-dark">
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {formatViewCount(video.view_count)} views
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(video.duration_seconds)}
            </span>
            {video.progress?.completed && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Watched
              </span>
            )}
          </div>

          {/* Description */}
          {video.description && (
            <div>
              <p
                className={cn(
                  'text-sm leading-relaxed text-text-muted dark:text-text-muted-dark',
                  !descExpanded && descriptionLong && 'line-clamp-3'
                )}
              >
                {video.description}
              </p>
              {descriptionLong && (
                <button
                  type="button"
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="mt-1 flex items-center gap-0.5 text-xs font-medium text-primary"
                >
                  {descExpanded ? (
                    <>
                      Show less <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Show more <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-gray-200 dark:bg-white/10" />

          {/* Reactions + Share row */}
          <div className="flex items-center gap-3">
            <VideoReactionBar
              videoId={video.id}
              initialReactionCounts={video.reaction_counts}
              initialTotalReactions={video.total_reactions}
              initialUserReaction={video.user_reaction}
            />
            <ShareVideoButton
              videoId={video.id}
              videoTitle={video.title}
            />
          </div>
        </div>
      </div>

      {/* Full-screen Video Player */}
      {playerOpen && (
        <VideoPlayerLazy
          videoUrl={video.video_url}
          captionUrl={video.caption_url}
          duration={video.duration_seconds}
          videoId={video.id}
          initialProgress={video.progress}
          onClose={() => {
            setPlayerOpen(false);
            // Refetch to update progress/reactions
            fetchVideo();
          }}
        />
      )}
    </>
  );
}

// Lazy-load the VideoPlayer to keep initial bundle small
import dynamic from 'next/dynamic';

const VideoPlayerLazy = dynamic(
  () => import('@/components/video/VideoPlayer').then((mod) => ({ default: mod.VideoPlayer })),
  { ssr: false }
);

// ---- Skeleton ----

function VideoDetailSkeleton() {
  return (
    <div className="flex flex-col pb-8">
      {/* Back button */}
      <div className="px-4 py-3">
        <div className="h-5 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Thumbnail skeleton */}
      <div className="aspect-video w-full animate-pulse bg-gray-200 dark:bg-gray-800" />

      {/* Content skeleton */}
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="h-7 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="flex gap-4">
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-px bg-gray-200 dark:bg-white/10" />
        <div className="flex gap-3">
          <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  );
}
