'use client';

import { useState, useRef, useCallback, Fragment } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { REACTION_EMOJI_MAP } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';
import type { FeedPost } from '@/hooks/useFeed';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { PostReactionPicker } from '@/components/social/PostReactionPicker';
import { RepostButton } from '@/components/social/RepostButton';
import { PostCommentSheet } from '@/components/social/PostCommentSheet';
import { TextPostGradient } from './TextPostGradient';
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

function RichText({ text }: { text: string }) {
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
              className="font-semibold text-white hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith('#')) {
          return (
            <span key={i} className="text-blue-300">
              {part}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ---- Types ----

interface PostCardTikTokProps {
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
 * TikTok-style full-screen post card with vertical action stack.
 */
export function PostCardTikTok({
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
}: PostCardTikTokProps) {
  const [expanded, setExpanded] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCountDelta, setCommentCountDelta] = useState(0);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const displayCommentCount = post.comment_count + commentCountDelta;
  const author = post.author;
  const hasMedia = post.media.length > 0;
  const firstMedia = hasMedia ? [...post.media].sort((a, b) => a.sort_order - b.sort_order)[0] : null;
  const isVideo = firstMedia?.media_type === 'video';

  const handleCommentDelta = (delta: number) => {
    setCommentCountDelta((prev) => prev + delta);
    onCommentCountChange?.(delta);
  };

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(videoRef.current.muted);
    }
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Background: media or gradient */}
      {hasMedia ? (
        <>
          {isVideo && firstMedia ? (
            <video
              ref={videoRef}
              src={firstMedia.url}
              poster={firstMedia.thumbnail_url ?? undefined}
              autoPlay
              muted={muted}
              loop
              playsInline
              onClick={toggleMute}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : firstMedia ? (
            <img
              src={firstMedia.url}
              alt="Post media"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        </>
      ) : (
        <TextPostGradient text={post.body} postId={post.id} />
      )}

      {/* Context menu (top right) */}
      <div className="absolute right-3 top-3 z-20">
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
          lightIcon
        />
      </div>

      {/* Right side vertical action stack */}
      <div className="absolute right-3 bottom-32 z-10 flex flex-col items-center gap-5">
        {/* Author avatar */}
        {author && (
          <Link href={`/profile/${author.username}`} className="mb-2">
            {author.avatar_url ? (
              <img
                src={author.avatar_url}
                alt={author.display_name}
                className="h-11 w-11 rounded-full border-2 border-white object-cover shadow-lg"
              />
            ) : (
              <InitialsAvatar
                name={author.display_name}
                color={author.avatar_color}
                size={44}
                className="border-2 border-white shadow-lg"
              />
            )}
          </Link>
        )}

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
          className="flex flex-col items-center gap-0.5 active:scale-90"
        >
          {userReaction ? (
            <span className="text-2xl leading-none drop-shadow-md">
              {REACTION_EMOJI_MAP[userReaction]}
            </span>
          ) : (
            <Heart className="h-7 w-7 text-white drop-shadow-md" />
          )}
          <span className="text-xs font-semibold text-white drop-shadow-md">
            {reactionTotal > 0 ? formatCount(reactionTotal) : ''}
          </span>
        </button>

        {/* Comment button */}
        <button
          type="button"
          onClick={() => setShowComments(true)}
          className="flex flex-col items-center gap-0.5 active:scale-90"
        >
          <MessageCircle className="h-7 w-7 text-white drop-shadow-md" />
          <span className="text-xs font-semibold text-white drop-shadow-md">
            {displayCommentCount > 0 ? formatCount(displayCommentCount) : ''}
          </span>
        </button>

        {/* Repost button */}
        <div className="flex flex-col items-center">
          <RepostButton
            postId={post.id}
            repostCount={post.repost_count}
          />
        </div>

        {/* Bookmark button */}
        <button
          type="button"
          onClick={onBookmark}
          className="flex flex-col items-center active:scale-90"
        >
          <Bookmark
            className={cn(
              'h-7 w-7 drop-shadow-md',
              post.bookmarked
                ? 'fill-amber-400 text-amber-400'
                : 'text-white'
            )}
          />
        </button>
      </div>

      {/* Bottom overlay: author name + text */}
      {hasMedia && (
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-20">
          {author && (
            <Link
              href={`/profile/${author.username}`}
              className="mb-1.5 inline-block text-sm font-bold text-white drop-shadow-md hover:underline"
            >
              @{author.username}
            </Link>
          )}
          {post.body && (
            <div>
              <p
                className={cn(
                  'text-sm leading-relaxed text-white/90 drop-shadow-md whitespace-pre-wrap break-words',
                  !expanded && 'line-clamp-3'
                )}
              >
                <RichText text={post.body} />
              </p>
              {post.body.length > 150 && !expanded && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="mt-0.5 text-sm font-semibold text-white/70"
                >
                  more
                </button>
              )}
            </div>
          )}
          {post.edited && (
            <span className="text-xs text-white/50">(edited)</span>
          )}
        </div>
      )}

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
    </div>
  );
}
