'use client';

import { useState, useRef, Fragment } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { REACTION_EMOJI_MAP } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';
import type { FeedPost } from '@/hooks/useFeed';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { PostReactionBar } from '@/components/social/PostReactionBar';
import { QuickReactionPicker } from '@/components/daily/QuickReactionPicker';
import { BookmarkButton } from '@/components/social/BookmarkButton';
import { RepostButton } from '@/components/social/RepostButton';
import { PostCommentSheet } from '@/components/social/PostCommentSheet';
import { MediaCarousel } from './MediaCarousel';
import { PostContextMenu } from './PostContextMenu';
import VerifiedBadge from '@/components/ui/VerifiedBadge';

// ---- Helpers ----

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  return `${w}w`;
}

function RichText({ text, white }: { text: string; white?: boolean }) {
  const parts = text.split(/(@[a-zA-Z0-9_]{3,30}|#[a-zA-Z0-9_]{1,50})/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const username = part.slice(1);
          return (
            <Link
              key={i}
              href={`/profile/${username}`}
              className={cn(
                'font-semibold hover:underline',
                white ? 'text-white/90' : 'font-medium text-primary'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith('#')) {
          return (
            <span
              key={i}
              className={cn(
                'font-medium',
                white ? 'text-blue-200' : 'text-primary'
              )}
            >
              {part}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

// Gradient palette for text-only posts — deterministic from post ID
const TEXT_GRADIENTS = [
  'from-violet-600 to-indigo-700',
  'from-rose-500 to-pink-700',
  'from-emerald-500 to-teal-700',
  'from-amber-500 to-orange-700',
  'from-sky-500 to-blue-700',
  'from-fuchsia-500 to-purple-700',
  'from-cyan-500 to-emerald-700',
  'from-red-500 to-rose-700',
] as const;

// ---- Types ----

interface PostCardInstagramProps {
  post: FeedPost;
  currentUserId: number | null;
  isBookmarked: boolean;
  reactionCounts: Record<string, number>;
  reactionTotal: number;
  userReaction: ReactionType | null;
  onToggleReaction: (type: ReactionType) => void;
  onCommentCountChange?: (delta: number) => void;
  onBookmark?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Instagram-style post card matching PrayerCard design:
 * rounded-2xl, shadow-lg, glassmorphism dark mode.
 * Text-only posts display on a gradient square background.
 */
export function PostCardInstagram({
  post,
  currentUserId,
  isBookmarked,
  reactionCounts,
  reactionTotal,
  userReaction,
  onToggleReaction,
  onCommentCountChange,
  onBookmark,
  onReport,
  onBlock,
  onEdit,
  onDelete,
}: PostCardInstagramProps) {
  const [expanded, setExpanded] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [showComments, setShowComments] = useState(false);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const displayCommentCount = post.comment_count;

  const author = post.author;
  const isTextOnly = post.body && post.media.length === 0 && !post.original_post;
  const needsTruncation = post.body.length > 400;
  const gradient = TEXT_GRADIENTS[post.id % TEXT_GRADIENTS.length];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-lg dark:border-white/20 dark:bg-white/10 dark:backdrop-blur-2xl">
      {/* Header — matches PrayerCard exactly */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {author && (
            <Link href={`/profile/${author.username}`} className="shrink-0">
              {author.avatar_url ? (
                <img
                  src={author.avatar_url}
                  alt={author.display_name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <InitialsAvatar
                  name={author.display_name}
                  color={author.avatar_color}
                  size={40}
                />
              )}
            </Link>
          )}

          <div>
            {author && (
              <p className="flex items-center gap-1 text-sm font-semibold text-text dark:text-white">
                <Link
                  href={`/profile/${author.username}`}
                  className="hover:underline"
                >
                  {author.display_name}
                </Link>
                {author.is_verified && <VerifiedBadge />}
              </p>
            )}
            <p className="text-xs text-text-muted dark:text-white/50">
              {relativeTime(post.created_at)}
              {post.edited && <span className="ml-1 text-text-muted/50 dark:text-white/30">(edited)</span>}
            </p>
          </div>
        </div>

        <PostContextMenu
          postId={post.id}
          authorId={post.user_id}
          currentUserId={currentUserId}
          onReport={onReport}
          onBlock={onBlock}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {/* Text-only post: gradient square background */}
      {isTextOnly && (
        <div
          className={cn(
            'mt-3 flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br p-6',
            gradient
          )}
        >
          <p
            className={cn(
              'text-center text-base font-medium leading-relaxed text-white whitespace-pre-wrap break-words',
              !expanded && needsTruncation && 'line-clamp-[12]'
            )}
          >
            <RichText text={expanded ? post.body : post.body.slice(0, 500)} white />
          </p>
        </div>
      )}

      {/* Non-text-only: regular body text — matches PrayerCard body */}
      {!isTextOnly && post.body && (
        <div className="mt-3">
          <p
            className={cn(
              'whitespace-pre-wrap text-sm leading-relaxed text-text dark:text-white/90 break-words',
              !expanded && needsTruncation && 'line-clamp-5'
            )}
          >
            <RichText text={post.body} />
          </p>
        </div>
      )}

      {/* Read more */}
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* Media carousel */}
      {post.media.length > 0 && (
        <div className="mt-3 -mx-4">
          <MediaCarousel
            media={post.media}
            rounded={false}
            aspectRatio={post.media.some((m) => m.media_type === 'video') ? '4 / 5' : undefined}
          />
        </div>
      )}

      {/* Quote repost / original post */}
      {post.original_post && (
        <Link
          href={`/post/${post.original_post.id}`}
          className="mt-3 block rounded-xl border border-border/50 bg-surface-dark/5 p-3 transition-colors hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
        >
          {post.original_post.deleted ? (
            <p className="text-sm italic text-text-muted dark:text-white/50">
              This post has been deleted
            </p>
          ) : (
            <>
              {post.original_post.author && (
                <div className="mb-1.5 flex items-center gap-2">
                  {post.original_post.author.avatar_url ? (
                    <img
                      src={post.original_post.author.avatar_url}
                      alt={post.original_post.author.display_name}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar
                      name={post.original_post.author.display_name}
                      color={post.original_post.author.avatar_color}
                      size={24}
                    />
                  )}
                  <span className="text-xs font-semibold text-text dark:text-white">
                    {post.original_post.author.display_name}
                  </span>
                  {post.original_post.author.is_verified && <VerifiedBadge className="h-3 w-3 shrink-0 text-blue-500" />}
                </div>
              )}
              <p className="line-clamp-3 text-sm text-text dark:text-white/90">
                <RichText text={post.original_post.body} />
              </p>
              {post.original_post.media.length > 0 && (
                <div className="mt-2">
                  <MediaCarousel media={post.original_post.media} />
                </div>
              )}
            </>
          )}
        </Link>
      )}

      {/* Action bar — matches PrayerCard separator */}
      <div ref={actionBarRef} className="relative mt-3 flex items-center justify-between border-t border-border/50 pt-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          {/* Reaction button — always opens picker */}
          <button
            type="button"
            onClick={(e) => setPickerAnchor(e.currentTarget.getBoundingClientRect())}
            className={cn(
              'rounded-full p-2 transition-colors',
              'hover:bg-black/5 dark:hover:bg-white/10',
              userReaction
                ? 'text-primary bg-primary/10 dark:bg-primary/20'
                : 'text-text-muted/60 dark:text-white/40'
            )}
            aria-label="React"
          >
            {userReaction ? (
              <span className="text-lg leading-none">
                {REACTION_EMOJI_MAP[userReaction]}
              </span>
            ) : (
              <Heart className="h-5 w-5" />
            )}
          </button>

          {/* Reaction bar (counts) */}
          {reactionTotal > 0 && (
            <PostReactionBar
              counts={reactionCounts}
              total={reactionTotal}
              userReaction={userReaction}
              onOpenPicker={(e) => setPickerAnchor(e.currentTarget.getBoundingClientRect())}
            />
          )}

          {/* Comment button */}
          <button
            type="button"
            onClick={() => setShowComments(true)}
            className={cn(
              'flex items-center gap-1 rounded-full p-2 transition-colors',
              'hover:bg-black/5 dark:hover:bg-white/10',
              'text-text-muted/60 dark:text-white/40'
            )}
            aria-label="Comment"
          >
            <MessageCircle className="h-5 w-5" />
            {displayCommentCount > 0 && (
              <span className="text-xs font-medium">{displayCommentCount}</span>
            )}
          </button>

          {/* Repost button */}
          <RepostButton
            postId={post.id}
            repostCount={post.repost_count}
            initialReposted={post.user_reposted}
            isOwnPost={currentUserId === post.user_id}
          />
        </div>

        {/* Bookmark (right-aligned) */}
        <BookmarkButton
          postId={post.id}
          initialBookmarked={isBookmarked}
        />
      </div>

      {/* Reaction picker — floating bar */}
      <QuickReactionPicker
        isOpen={pickerAnchor !== null}
        onClose={() => setPickerAnchor(null)}
        onSelect={(type) => {
          onToggleReaction(type);
          setPickerAnchor(null);
        }}
        anchorRect={pickerAnchor}
        selectedReaction={userReaction}
      />

      {/* Comment sheet */}
      <PostCommentSheet
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        postId={post.id}
        commentCount={displayCommentCount}
        onCommentCountChange={onCommentCountChange}
      />
    </div>
  );
}
