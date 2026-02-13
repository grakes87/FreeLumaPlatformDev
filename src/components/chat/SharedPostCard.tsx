'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import type { SharedPost } from '@/hooks/useChat';

interface SharedPostCardProps {
  post: SharedPost;
  className?: string;
}

/**
 * Compact card preview of a shared post inside a chat message bubble.
 * Shows author info, text snippet, and optional media thumbnail.
 * Tappable to navigate to /post/[id].
 */
export function SharedPostCard({ post, className }: SharedPostCardProps) {
  const mediaThumb = post.media?.[0];
  const textSnippet = post.body
    ? post.body.length > 120
      ? post.body.slice(0, 120) + '...'
      : post.body
    : null;

  return (
    <Link
      href={`/post/${post.id}`}
      className={cn(
        'block overflow-hidden rounded-xl border border-white/20 dark:border-white/10',
        'bg-white/5 backdrop-blur-sm transition-colors active:bg-white/10',
        className
      )}
    >
      {/* Media thumbnail */}
      {mediaThumb && (
        <div className="relative h-32 w-full bg-black/10">
          <Image
            src={mediaThumb.thumbnail_url || mediaThumb.url}
            alt="Post media"
            fill
            className="object-cover"
            sizes="280px"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {/* Author row */}
        <div className="flex items-center gap-2 mb-1.5">
          {post.user.avatar_url ? (
            <Image
              src={post.user.avatar_url}
              alt={post.user.display_name}
              width={20}
              height={20}
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <InitialsAvatar
              name={post.user.display_name}
              color={post.user.avatar_color}
              size={20}
              className="text-[8px]"
            />
          )}
          <span className="text-xs font-medium text-white/80 dark:text-white/80">
            {post.user.display_name}
          </span>
        </div>

        {/* Text snippet */}
        {textSnippet && (
          <p className="text-sm leading-snug text-white/70 dark:text-white/70">
            {textSnippet}
          </p>
        )}

        {!textSnippet && !mediaThumb && (
          <p className="text-sm italic text-white/40">Shared post</p>
        )}
      </div>
    </Link>
  );
}
