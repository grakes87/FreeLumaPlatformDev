'use client';

import { useCallback, useRef, useState } from 'react';
import { Eye, Heart, Play } from 'lucide-react';
import type { ProfileTab } from './ProfileTabs';

const GRADIENTS = [
  'from-teal-900 via-teal-800 to-cyan-900',
  'from-purple-900 via-violet-800 to-fuchsia-900',
  'from-orange-600 via-red-600 to-pink-700',
  'from-emerald-800 via-green-700 to-teal-800',
  'from-amber-600 via-orange-600 to-red-600',
  'from-slate-900 via-teal-900 to-cyan-900',
  'from-rose-700 via-pink-600 to-purple-700',
  'from-cyan-700 via-teal-700 to-blue-800',
  'from-teal-800 via-cyan-700 to-blue-800',
  'from-red-800 via-rose-700 to-pink-800',
];

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 10_000) return `${(count / 1_000).toFixed(0)}K`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return count.toString();
}

// Track which media IDs have had thumbnail capture attempted (avoids retries across re-renders)
const attemptedCaptures = new Set<number>();

function uploadThumbnail(mediaId: number, blob: Blob) {
  const form = new FormData();
  form.append('file', blob, 'thumbnail.jpg');
  fetch(`/api/posts/media/${mediaId}/thumbnail`, {
    method: 'PATCH',
    credentials: 'include',
    body: form,
  }).catch(() => {
    // Fire-and-forget — failure is non-critical
  });
}

/**
 * Renders a video's first frame and auto-captures it as a cached thumbnail.
 * First load uses <video> to display + capture. On capture success, swaps to <img>.
 * Falls back gracefully if CORS blocks canvas capture.
 */
function VideoThumbnailCapture({
  videoUrl,
  mediaId,
  className,
}: {
  videoUrl: string;
  mediaId: number;
  className: string;
}) {
  const [capturedSrc, setCapturedSrc] = useState<string | null>(null);
  const [corsBlocked, setCorsBlocked] = useState(false);
  const attemptedRef = useRef(false);

  const handleLoadedData = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (attemptedRef.current || attemptedCaptures.has(mediaId)) return;
      attemptedRef.current = true;
      attemptedCaptures.add(mediaId);
      const video = e.currentTarget;
      video.currentTime = 0.5;
    },
    [mediaId]
  );

  const handleSeeked = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      try {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setCapturedSrc(dataUrl);
        canvas.toBlob(
          (blob) => {
            if (blob) uploadThumbnail(mediaId, blob);
          },
          'image/jpeg',
          0.7
        );
      } catch {
        // CORS or SecurityError — keep showing the video element
      }
    },
    [mediaId]
  );

  if (capturedSrc) {
    return <img src={capturedSrc} alt="" className={className} loading="lazy" />;
  }

  // If crossOrigin="anonymous" caused a load failure, fall back to no-CORS video display
  if (corsBlocked) {
    return (
      <video
        src={`${videoUrl}#t=0.001`}
        className={className}
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <video
      src={`${videoUrl}#t=0.001`}
      className={className}
      muted
      playsInline
      preload="metadata"
      crossOrigin="anonymous"
      onLoadedData={handleLoadedData}
      onSeeked={handleSeeked}
      onError={() => setCorsBlocked(true)}
    />
  );
}

/** Max thumbnail dimension (covers retina at ~200px grid cells) */
const THUMB_MAX_SIZE = 400;
const THUMB_QUALITY = 0.7;

/**
 * Renders an image and auto-captures a downsized thumbnail for the grid.
 * First load shows the full image; once loaded, generates a smaller JPEG,
 * uploads it, and subsequent visits use the cached thumbnail.
 */
function ImageThumbnailCapture({
  imageUrl,
  mediaId,
  className,
}: {
  imageUrl: string;
  mediaId: number;
  className: string;
}) {
  const attemptedRef = useRef(false);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (attemptedRef.current || attemptedCaptures.has(mediaId)) return;
      attemptedRef.current = true;
      attemptedCaptures.add(mediaId);

      const img = e.currentTarget;
      try {
        const { naturalWidth: nw, naturalHeight: nh } = img;
        // Skip if image is already small enough
        if (nw <= THUMB_MAX_SIZE && nh <= THUMB_MAX_SIZE) return;

        const scale = Math.min(THUMB_MAX_SIZE / nw, THUMB_MAX_SIZE / nh);
        const w = Math.round(nw * scale);
        const h = Math.round(nh * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) uploadThumbnail(mediaId, blob);
          },
          'image/jpeg',
          THUMB_QUALITY
        );
      } catch {
        // CORS or SecurityError — non-critical
      }
    },
    [mediaId]
  );

  return (
    <img
      src={imageUrl}
      alt=""
      className={className}
      loading="lazy"
      crossOrigin="anonymous"
      onLoad={handleLoad}
      onError={(e) => {
        // If crossOrigin blocked loading, retry without it
        const img = e.currentTarget;
        if (img.crossOrigin) {
          img.crossOrigin = '';
          img.src = imageUrl;
        }
      }}
    />
  );
}

interface ProfileGridItemProps {
  item: Record<string, unknown>;
  tab: ProfileTab;
  onClick?: () => void;
}

/**
 * TikTok-style square grid cell for profile post grid.
 * Shows thumbnail for media posts, gradient + text for text-only posts.
 * Bottom-left overlay with eye icon + view count.
 */
export function ProfileGridItem({ item, tab, onClick }: ProfileGridItemProps) {
  // Resolve the actual post based on tab type
  let post: Record<string, unknown> | null = null;

  if (tab === 'saved') {
    post = (item.post as Record<string, unknown>) || null;
  } else if (tab === 'reposts') {
    // For reposts, prefer originalPost (has media) over quotePost for grid display
    const originalPost = item.originalPost as Record<string, unknown> | null;
    const quotePost = item.quotePost as Record<string, unknown> | null;
    post = originalPost || quotePost || null;
  } else {
    post = item;
  }

  if (!post) return null;

  const postId = post.id as number;
  const body = (post.body as string) || '';
  const reactionCount = (post.reaction_count as number) || 0;
  const viewCount = (post.view_count as number) || 0;
  const media = (post.media as Array<Record<string, unknown>>) || [];

  // Determine display type
  const firstVideo = media.find((m) => m.media_type === 'video');
  const firstImage = media.find((m) => m.media_type === 'image');
  const hasVideoThumbnail = firstVideo && firstVideo.thumbnail_url;
  const hasImageThumbnail = firstImage && firstImage.thumbnail_url;
  const isVideo = !!firstVideo;
  const isImage = !isVideo && !!firstImage;
  const isTextOnly = !isVideo && !isImage;

  // Get cached thumbnail URL (video thumbnail or downsized image thumbnail)
  const thumbnailUrl = hasVideoThumbnail
    ? (firstVideo!.thumbnail_url as string)
    : hasImageThumbnail
    ? (firstImage!.thumbnail_url as string)
    : null;

  const gradientClass = isTextOnly
    ? GRADIENTS[postId % GRADIENTS.length]
    : '';

  return (
    <div onClick={onClick} role="button" tabIndex={0} className="block cursor-pointer" onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(); }}>
      <div className="relative aspect-square overflow-hidden bg-slate-200 dark:bg-slate-800">
        {/* Content */}
        {isTextOnly ? (
          // Text-only: gradient background + truncated text
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientClass} p-3`}
          >
            <p className="text-xs font-medium leading-snug text-white text-center line-clamp-4">
              {body}
            </p>
          </div>
        ) : isVideo && !hasVideoThumbnail ? (
          // Video without thumbnail: capture first frame and cache as thumbnail
          <VideoThumbnailCapture
            videoUrl={firstVideo!.url as string}
            mediaId={firstVideo!.id as number}
            className="h-full w-full object-cover"
          />
        ) : isImage && !hasImageThumbnail ? (
          // Image without thumbnail: show full image + capture downsized version
          <ImageThumbnailCapture
            imageUrl={firstImage!.url as string}
            mediaId={firstImage!.id as number}
            className="h-full w-full object-cover"
          />
        ) : (
          // Cached thumbnail available (video or image)
          <img
            src={thumbnailUrl!}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}

        {/* Video play icon overlay */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="h-8 w-8 text-white drop-shadow-lg" fill="white" fillOpacity={0.9} />
          </div>
        )}

        {/* Bottom gradient for readability */}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Bottom-left: heart + reaction count */}
        <div className="absolute bottom-1 left-1.5 flex items-center gap-0.5 text-white">
          <Heart className="h-3 w-3" fill="white" />
          <span className="text-[11px] font-semibold drop-shadow">
            {formatCount(reactionCount)}
          </span>
        </div>

        {/* Bottom-right: eye + view count — posts and reposts tabs */}
        {(tab === 'posts' || tab === 'reposts') && viewCount > 0 && (
          <div className="absolute bottom-1 right-1.5 flex items-center gap-0.5 text-white">
            <Eye className="h-3 w-3" />
            <span className="text-[11px] font-semibold drop-shadow">
              {formatCount(viewCount)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
