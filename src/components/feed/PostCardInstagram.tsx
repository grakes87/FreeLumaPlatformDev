'use client';

import { useState, useMemo, Fragment } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { REACTION_EMOJI_MAP } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';
import type { FeedPost } from '@/hooks/useFeed';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { PostReactionBar } from '@/components/social/PostReactionBar';
import { PostReactionPicker } from '@/components/social/PostReactionPicker';
import { BookmarkButton } from '@/components/social/BookmarkButton';
import { RepostButton } from '@/components/social/RepostButton';
import { PostCommentSheet } from '@/components/social/PostCommentSheet';
import { MediaCarousel } from './MediaCarousel';
import { PostContextMenu } from './PostContextMenu';

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

/**
 * Render text with @mentions (bold, linked) and #hashtags (blue).
 */
function RichText({ text }: { text: string }) {
  // Regex matches @username and #hashtag tokens
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
              className="font-semibold text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith('#')) {
          return (
            <span key={i} className="text-blue-500 dark:text-blue-400">
              {part}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

// ---- Types ----

interface PostCardInstagramProps {
  post: FeedPost;
  currentUserId: number | null;
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
 * Instagram-style post card: rounded card with shadow, header, text, media, action bar.
 */
export function PostCardInstagram({
  post,
  currentUserId,
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
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCountDelta, setCommentCountDelta] = useState(0);

  const displayCommentCount = post.comment_count + commentCountDelta;

  const author = post.author;
  const isTextLong = post.body.length > 300;

  const handleCommentDelta = (delta: number) => {
    setCommentCountDelta((prev) => prev + delta);
    onCommentCountChange?.(delta);
  };

  return (
    <article className="rounded-2xl border border-border/50 bg-surface p-4 shadow-sm dark:border-border-dark/50 dark:bg-surface-dark">
      {/* Header: avatar + name + time + context menu */}
      <div className="mb-3 flex items-center gap-3">
        {author && (
          <Link
            href={`/profile/${author.username}`}
            className="shrink-0"
          >
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

        <div className="min-w-0 flex-1">
          {author && (
            <Link
              href={`/profile/${author.username}`}
              className="block truncate text-sm font-semibold text-text hover:underline dark:text-text-dark"
            >
              {author.display_name}
            </Link>
          )}
          <p className="text-xs text-text-muted dark:text-text-muted-dark">
            {relativeTime(post.created_at)}
            {post.edited && ' (edited)'}
          </p>
        </div>

        <PostContextMenu
          postId={post.id}
          authorId={post.user_id}
          currentUserId={currentUserId}
          isBookmarked={post.bookmarked}
          onBookmark={onBookmark}
          onReport={onReport}
          onBlock={onBlock}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {/* Body text */}
      {post.body && (
        <div className="mb-3">
          <p
            className={cn(
              'text-sm leading-relaxed text-text dark:text-text-dark whitespace-pre-wrap break-words',
              !expanded && isTextLong && 'line-clamp-5'
            )}
          >
            <RichText text={post.body} />
          </p>
          {isTextLong && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-0.5 text-sm font-medium text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
            >
              Read more
            </button>
          )}
        </div>
      )}

      {/* Media carousel */}
      {post.media.length > 0 && (
        <div className="mb-3 -mx-4">
          <MediaCarousel media={post.media} rounded={false} />
        </div>
      )}

      {/* Quote repost / original post */}
      {post.original_post && (
        <div className="mb-3 rounded-xl border border-border/50 bg-slate-50 p-3 dark:border-border-dark/50 dark:bg-slate-800/50">
          {post.original_post.deleted ? (
            <p className="text-sm italic text-text-muted dark:text-text-muted-dark">
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
                  <span className="text-xs font-semibold text-text dark:text-text-dark">
                    {post.original_post.author.display_name}
                  </span>
                </div>
              )}
              <p className="line-clamp-3 text-sm text-text dark:text-text-dark">
                <RichText text={post.original_post.body} />
              </p>
              {post.original_post.media.length > 0 && (
                <div className="mt-2">
                  <MediaCarousel media={post.original_post.media} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Reaction button */}
          <button
            type="button"
            onClick={() => {
              if (userReaction) {
                onToggleReaction(userReaction);
              } else {
                setShowReactionPicker(true);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowReactionPicker(true);
            }}
            className={cn(
              'flex items-center justify-center rounded-full p-2 transition-colors',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              userReaction
                ? 'text-primary'
                : 'text-text-muted dark:text-text-muted-dark'
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
          <PostReactionBar
            counts={reactionCounts}
            total={reactionTotal}
            userReaction={userReaction}
            onOpenPicker={() => setShowReactionPicker(true)}
          />

          {/* Comment button */}
          <button
            type="button"
            onClick={() => setShowComments(true)}
            className={cn(
              'flex items-center gap-1 rounded-full p-2 transition-colors',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              'text-text-muted dark:text-text-muted-dark'
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
          />
        </div>

        {/* Bookmark (right-aligned) */}
        <BookmarkButton
          postId={post.id}
          initialBookmarked={post.bookmarked}
        />
      </div>

      {/* Reaction picker portal */}
      <PostReactionPicker
        isOpen={showReactionPicker}
        onClose={() => setShowReactionPicker(false)}
        counts={reactionCounts}
        userReaction={userReaction}
        onSelect={(type) => {
          onToggleReaction(type);
          setShowReactionPicker(false);
        }}
      />

      {/* Comment sheet */}
      <PostCommentSheet
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        postId={post.id}
        commentCount={displayCommentCount}
        onCommentCountChange={handleCommentDelta}
      />
    </article>
  );
}
