'use client';

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
  const isVideo = !!firstVideo;
  const isImage = !isVideo && !!firstImage;
  const isTextOnly = !isVideo && !isImage;

  // Get thumbnail URL for images or videos with thumbnails
  const thumbnailUrl = hasVideoThumbnail
    ? (firstVideo!.thumbnail_url as string)
    : isImage
    ? (firstImage!.url as string)
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
          // Video without thumbnail: use <video> to grab first frame
          <video
            src={`${firstVideo!.url as string}#t=0.001`}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          // Image or video with thumbnail
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
