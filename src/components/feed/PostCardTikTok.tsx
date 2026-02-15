'use client';

import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Bookmark, Repeat2, Volume2, VolumeX, Play, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { REACTION_EMOJI_MAP } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';
import type { FeedPost } from '@/hooks/useFeed';
import { useFeedMute } from '@/context/FeedMuteContext';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { QuickReactionPicker } from '@/components/daily/QuickReactionPicker';
import { RepostButton } from '@/components/social/RepostButton';
import { PostCommentSheet } from '@/components/social/PostCommentSheet';
import { TextPostGradient } from './TextPostGradient';
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
 * TikTok-style full-screen post card with vertical action stack.
 */
export function PostCardTikTok({
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
}: PostCardTikTokProps) {
  const [expanded, setExpanded] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const cardRef = useRef<HTMLDivElement>(null);
  const mediaScrollRef = useRef<HTMLDivElement>(null);
  const userPausedRef = useRef(false);
  const { muted, toggleMute } = useFeedMute();

  const displayCommentCount = post.comment_count;
  const author = post.author;
  const isRepost = !!post.original_post;
  const hasMedia = post.media.length > 0;
  const sortedMedia = hasMedia
    ? [...post.media].sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const isMultiMedia = sortedMedia.length > 1;
  const activeMedia = sortedMedia[activeMediaIndex] ?? null;
  const activeIsVideo = activeMedia?.media_type === 'video';
  const hasAnyVideo = sortedMedia.some((m) => m.media_type === 'video');

  // Track active media index from horizontal scroll
  const handleMediaScroll = useCallback(() => {
    const el = mediaScrollRef.current;
    if (!el) return;
    const index = Math.min(
      Math.round(el.scrollLeft / el.clientWidth),
      sortedMedia.length - 1
    );
    setActiveMediaIndex(Math.max(0, index));
  }, [sortedMedia.length]);

  // Tap active video to play/pause
  const togglePlayPause = useCallback(() => {
    if (!activeMedia) return;
    const video = videoRefs.current.get(activeMedia.id);
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      userPausedRef.current = false;
      setUserPaused(false);
    } else {
      video.pause();
      userPausedRef.current = true;
      setUserPaused(true);
    }
  }, [activeMedia]);

  // Sync global mute state to all video elements
  useEffect(() => {
    videoRefs.current.forEach((video) => {
      video.muted = muted;
    });
  }, [muted]);

  // When active slide changes, pause all videos except the active one
  useEffect(() => {
    if (!activeMedia) return;
    videoRefs.current.forEach((video, id) => {
      if (id === activeMedia.id) {
        if (!userPausedRef.current) {
          video.play().catch(() => {});
        }
      } else {
        video.pause();
      }
    });
  }, [activeMediaIndex, activeMedia]);

  // Auto-play/pause based on card scroll visibility (respects user pause)
  useEffect(() => {
    const card = cardRef.current;
    if (!hasAnyVideo || !card) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!userPausedRef.current && activeMedia?.media_type === 'video') {
            const video = videoRefs.current.get(activeMedia.id);
            video?.play().catch(() => {});
          }
        } else {
          // Pause all videos when card scrolls out of view
          videoRefs.current.forEach((video) => video.pause());
          userPausedRef.current = false;
          setUserPaused(false);
          // Collapse expanded text on scroll away
          setExpanded(false);
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [hasAnyVideo, activeMedia]);

  // Collapse expanded text when card scrolls out of view (non-video posts)
  useEffect(() => {
    const card = cardRef.current;
    if (hasAnyVideo || !card) return; // video posts already handled above

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setExpanded(false);
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [hasAnyVideo]);

  const handleVideoRef = useCallback((id: number, el: HTMLVideoElement | null) => {
    if (el) {
      videoRefs.current.set(id, el);
    } else {
      videoRefs.current.delete(id);
    }
  }, []);

  return (
    <div ref={cardRef} className="relative h-full w-full overflow-hidden bg-black">
      {/* Background: media carousel, gradient, or repost card */}
      {hasMedia ? (
        <>
          {/* Horizontal media carousel */}
          <div
            ref={mediaScrollRef}
            className={cn(
              'absolute inset-0 flex overflow-x-auto scrollbar-hide',
              isMultiMedia && 'snap-x snap-mandatory'
            )}
            onScroll={handleMediaScroll}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-x pan-y' }}
          >
            {sortedMedia.map((media) => (
              <div
                key={media.id}
                className={cn(
                  'relative h-full w-full shrink-0',
                  isMultiMedia && 'snap-center'
                )}
              >
                {media.media_type === 'video' ? (
                  <video
                    ref={(el) => handleVideoRef(media.id, el)}
                    src={media.url}
                    poster={media.thumbnail_url ?? undefined}
                    autoPlay={media.id === sortedMedia[0]?.id}
                    muted
                    loop
                    playsInline
                    onClick={togglePlayPause}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={media.url}
                    alt="Post media"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Dark gradient overlays for text and icon readability */}
          <div className={cn(
            'pointer-events-none absolute inset-0 transition-colors duration-300',
            expanded
              ? 'bg-black/70'
              : 'bg-gradient-to-t from-black/80 via-transparent to-black/20'
          )} />
          <div className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-24 transition-opacity duration-300',
            expanded ? 'opacity-0' : 'bg-gradient-to-l from-black/40 to-transparent'
          )} />
        </>
      ) : isRepost ? (
        <TextPostGradient text="" postId={post.id} />
      ) : (
        <TextPostGradient text={post.body} postId={post.id} />
      )}

      {/* Content overlay — sized to dynamic viewport so icons/text stay visible */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: '100svh' }}>

      {/* Play icon — visible only while paused on a video slide */}
      {activeIsVideo && userPaused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
            <Play className="h-7 w-7 text-white/80 ml-0.5" />
          </div>
        </div>
      )}

      {/* Mute / unmute button (when any media is a video) */}
      {hasAnyVideo && (
        <button
          type="button"
          onClick={toggleMute}
          className="pointer-events-auto absolute right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm active:scale-90"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 1rem)' }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <VolumeX className="h-4.5 w-4.5 text-white" />
          ) : (
            <Volume2 className="h-4.5 w-4.5 text-white" />
          )}
        </button>
      )}

      {/* Right side vertical action stack */}
      <div
        className="pointer-events-auto absolute right-3 z-20 flex flex-col items-center gap-5"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 4.5rem)' }}
      >
        {/* Own post: edit pencil, other's post: context menu */}
        {currentUserId !== null && currentUserId === post.user_id ? (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full p-1.5 text-white hover:bg-white/10 active:scale-90"
            aria-label="Edit post"
          >
            <Pencil className="h-7 w-7 drop-shadow-md" />
          </button>
        ) : (
          <PostContextMenu
            postId={post.id}
            authorId={post.user_id}
            currentUserId={currentUserId}
            onReport={onReport}
            onBlock={onBlock}
            lightIcon
          />
        )}

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
          onClick={(e) => {
            if (userReaction) {
              onToggleReaction(userReaction);
            } else {
              setPickerAnchor(e.currentTarget.getBoundingClientRect());
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setPickerAnchor(e.currentTarget.getBoundingClientRect());
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
        <RepostButton
          postId={post.id}
          repostCount={post.repost_count}
          initialReposted={post.user_reposted}
          isOwnPost={currentUserId === post.user_id}
          variant="tiktok"
        />

        {/* Bookmark button */}
        <button
          type="button"
          onClick={onBookmark}
          className="flex flex-col items-center active:scale-90"
        >
          <Bookmark
            className={cn(
              'h-7 w-7 drop-shadow-md',
              isBookmarked
                ? 'fill-amber-400 text-amber-400'
                : 'text-white'
            )}
          />
        </button>

      </div>

      {/* Pagination dots — absolutely centered on full card width */}
      {isMultiMedia && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 10.5rem)' }}
        >
          <div className="flex items-center gap-1.5">
            {sortedMedia.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === activeMediaIndex
                    ? 'w-4 bg-white'
                    : 'w-1.5 bg-white/50'
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom overlay: author name + text + repost content */}
      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 px-4 pr-16"
        style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        {/* Repost indicator */}
        {isRepost && author && (
          <div className="mb-2 flex items-center gap-1.5 text-white/60 drop-shadow-md">
            <Repeat2 className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{author.display_name}{author.is_verified && <VerifiedBadge className="ml-0.5 inline-block h-3 w-3 shrink-0 text-blue-400" />} reposted</span>
          </div>
        )}

        {/* Author info */}
        {author && !isRepost && (
          <div className="mb-1.5 flex items-center gap-1">
            <Link
              href={`/profile/${author.username}`}
              className="text-sm font-bold text-white drop-shadow-md hover:underline"
            >
              @{author.username}
            </Link>
            {author.is_verified && <VerifiedBadge className="h-3.5 w-3.5 shrink-0 text-blue-400 drop-shadow-md" />}
          </div>
        )}

        {/* Quote body (repost comment) */}
        {isRepost && post.body && (
          <div className="mb-2">
            <p className="text-sm leading-relaxed text-white/90 drop-shadow-md whitespace-pre-wrap break-words">
              <RichText text={post.body} />
            </p>
          </div>
        )}

        {/* Original post card for reposts */}
        {isRepost && post.original_post && (
          <Link
            href={`/post/${post.original_post.id}`}
            className="mb-2 block rounded-xl border border-white/20 bg-black/40 p-3 backdrop-blur-sm active:bg-black/60 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {post.original_post.deleted ? (
              <p className="text-sm italic text-white/50">This post has been deleted</p>
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
                    <span className="text-xs font-semibold text-white/90">
                      {post.original_post.author.display_name}
                    </span>
                    {post.original_post.author.is_verified && <VerifiedBadge className="h-3 w-3 shrink-0 text-blue-400" />}
                  </div>
                )}
                <p className="line-clamp-4 text-sm leading-relaxed text-white/80 whitespace-pre-wrap break-words">
                  <RichText text={post.original_post.body} />
                </p>
                {post.original_post.media.length > 0 && (
                  <div className="mt-2 flex gap-1.5 overflow-hidden rounded-lg">
                    {post.original_post.media.slice(0, 2).map((m) => (
                      <img
                        key={m.id}
                        src={m.thumbnail_url || m.url}
                        alt=""
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Link>
        )}

        {/* Regular text body (non-repost, media posts) */}
        {!isRepost && hasMedia && post.body && (
          <div>
            <p
              className={cn(
                'text-sm leading-relaxed text-white/90 drop-shadow-md whitespace-pre-wrap break-words',
                !expanded && 'line-clamp-3',
                expanded && 'max-h-[50vh] overflow-y-auto'
              )}
            >
              <RichText text={post.body} />
            </p>
            {post.body.length > 150 && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-0.5 text-sm font-semibold text-white/70"
              >
                {expanded ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}

        {post.edited && (
          <span className="text-xs text-white/50">(edited)</span>
        )}
      </div>

      </div>{/* end content overlay */}

      {/* Reaction picker */}
      <QuickReactionPicker
        isOpen={pickerAnchor !== null}
        onClose={() => setPickerAnchor(null)}
        onSelect={(type) => {
          onToggleReaction(type);
          setPickerAnchor(null);
        }}
        anchorRect={pickerAnchor}
        placement="left"
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
