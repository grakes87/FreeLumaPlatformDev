'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MessageSquare,
  Loader2,
  Send,
  MoreHorizontal,
  Heart,
  Repeat2,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { usePostComments, type PostComment } from '@/hooks/usePostComments';
import { usePostReactions } from '@/hooks/usePostReactions';
import { useBookmark } from '@/hooks/useBookmark';
import { REACTION_EMOJI_MAP } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';
import { QuickReactionPicker } from '@/components/daily/QuickReactionPicker';
import { POST_COMMENT_MAX_LENGTH } from '@/lib/utils/constants';

// ---- Types ----

interface PostAuthor {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface PostMediaItem {
  id: number;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  sort_order: number;
}

interface PostDetail {
  id: number;
  user_id: number;
  body: string;
  post_type: 'text' | 'prayer_request';
  visibility: 'public' | 'followers';
  mode: 'bible' | 'positivity';
  edited: boolean;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  user: PostAuthor;
  media: PostMediaItem[];
  reaction_counts: Record<string, number>;
  total_reactions: number;
  comment_count: number;
  user_reaction: string | null;
  is_bookmarked: boolean;
  is_own: boolean;
}

// ---- Helpers ----

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function Avatar({ user, size = 'md' }: { user: PostAuthor; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name}
        className={cn(dim, 'rounded-full object-cover')}
      />
    );
  }
  const initials = user.display_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        dim,
        textSize,
        'flex items-center justify-center rounded-full font-bold text-white'
      )}
      style={{ backgroundColor: user.avatar_color }}
    >
      {initials}
    </div>
  );
}

// ---- Render post body with @mentions and #hashtags ----

function PostBody({ text }: { text: string }) {
  const parts = text.split(/(@\w+|#\w+)/g);

  return (
    <p className="whitespace-pre-wrap text-text dark:text-text-dark">
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          return (
            <a
              key={i}
              href={`/profile/${part.slice(1)}`}
              className="font-semibold text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        if (part.startsWith('#')) {
          return (
            <span key={i} className="text-primary">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

// ---- Media display ----

function PostMediaDisplay({ media }: { media: PostMediaItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (media.length === 0) return null;

  return (
    <div className="relative mt-3">
      <div className="overflow-hidden rounded-xl">
        {media[activeIndex].media_type === 'image' ? (
          <img
            src={media[activeIndex].url}
            alt="Post media"
            className="w-full object-contain"
            style={{ maxHeight: '60vh' }}
          />
        ) : (
          <video
            src={media[activeIndex].url}
            controls
            playsInline
            className="w-full"
            style={{ maxHeight: '60vh' }}
            poster={media[activeIndex].thumbnail_url ?? undefined}
          />
        )}
      </div>

      {/* Pagination dots */}
      {media.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {media.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                idx === activeIndex
                  ? 'w-4 bg-primary'
                  : 'w-1.5 bg-text-muted/30 dark:bg-text-muted-dark/30'
              )}
              aria-label={`View image ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Comment item for inline thread ----

function InlineCommentItem({
  comment,
  postId,
  depth,
  onReply,
}: {
  comment: PostComment;
  postId: number;
  depth: number;
  onReply?: (commentId: number) => void;
}) {
  return (
    <div
      className={cn(
        'flex gap-2 py-2',
        depth > 0 && 'ml-10 border-l-2 border-border pl-3 dark:border-border-dark'
      )}
    >
      <div className="flex-shrink-0 pt-0.5">
        <Avatar user={comment.user} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text dark:text-text-dark">
            {comment.user.display_name}
          </span>
          <span className="text-xs text-text-muted dark:text-text-muted-dark">
            {relativeTime(comment.created_at)}
          </span>
          {comment.edited && (
            <span className="text-xs italic text-text-muted dark:text-text-muted-dark">
              edited
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-text dark:text-text-dark break-words">
          {comment.body}
        </p>
        {depth === 0 && onReply && (
          <button
            type="button"
            onClick={() => onReply(comment.id)}
            className="mt-1 text-xs font-medium text-text-muted hover:text-primary dark:text-text-muted-dark"
          >
            Reply
          </button>
        )}
        {/* Show replies inline */}
        {depth === 0 && comment.replies && comment.replies.length > 0 && (
          <div className="mt-1">
            {comment.replies.map((reply) => (
              <InlineCommentItem
                key={reply.id}
                comment={reply}
                postId={postId}
                depth={1}
              />
            ))}
            {comment.reply_count > comment.replies.length && (
              <span className="ml-10 text-xs text-text-muted dark:text-text-muted-dark">
                {comment.reply_count - comment.replies.length} more replies
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main Post Detail Page ----

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const postId = typeof params.id === 'string' ? parseInt(params.id, 10) : NaN;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // Comment input
  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<number | null>(null);

  const {
    comments,
    hasMore,
    loading: commentsLoading,
    submitting: commentSubmitting,
    fetchComments,
    loadMore,
    addComment,
  } = usePostComments(isNaN(postId) ? null : postId);

  // Reactions
  const {
    counts: reactionCounts,
    total: reactionTotal,
    userReaction,
    toggleReaction,
  } = usePostReactions(isNaN(postId) ? null : postId);

  // Bookmark
  const { isBookmarked, toggle: toggleBookmark } = useBookmark(
    isNaN(postId) ? 0 : postId,
    post?.is_bookmarked ?? false
  );

  // Reaction picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const reactionBtnRef = useRef<HTMLButtonElement>(null);

  const handleOpenPicker = useCallback(() => {
    if (reactionBtnRef.current) {
      setPickerRect(reactionBtnRef.current.getBoundingClientRect());
    }
    setPickerOpen(true);
  }, []);

  const handleSelectReaction = useCallback(
    (type: ReactionType) => {
      toggleReaction(type);
      setPickerOpen(false);
    },
    [toggleReaction]
  );

  // Fetch post detail
  useEffect(() => {
    if (isNaN(postId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    fetch(`/api/posts/${postId}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setPost(data);
          setCommentCount(data.comment_count);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [postId]);

  // Fetch comments
  useEffect(() => {
    if (!isNaN(postId) && !loading && post) {
      fetchComments(null, 20);
    }
  }, [postId, loading, post, fetchComments]);

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!text) return;

    const result = await addComment(text, replyToId);
    if (result) {
      setCommentText('');
      setReplyToId(null);
      setCommentCount((c) => c + 1);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-7.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not found state
  if (notFound || !post) {
    return (
      <div className="flex min-h-[calc(100vh-7.5rem)] flex-col items-center justify-center gap-4 px-4">
        <MessageSquare className="h-12 w-12 text-text-muted dark:text-text-muted-dark" />
        <h1 className="text-xl font-semibold text-text dark:text-text-dark">
          Post not found
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          This post may have been deleted or is not available.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-7.5rem)] pb-20">
      {/* Top bar with back button */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg p-1 text-text-muted transition-colors hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-text dark:text-text-dark">
          Post
        </h1>
      </div>

      {/* Post content */}
      <div className="px-4 pt-4">
        {/* Author header */}
        <div className="flex items-center gap-3">
          <Avatar user={post.user} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-text dark:text-text-dark">
              {post.user.display_name}
            </div>
            <div className="text-sm text-text-muted dark:text-text-muted-dark">
              @{post.user.username} &middot; {relativeTime(post.created_at)}
              {post.edited && ' (edited)'}
            </div>
          </div>
        </div>

        {/* Post body */}
        <div className="mt-3">
          <PostBody text={post.body} />
        </div>

        {/* Media */}
        <PostMediaDisplay media={post.media} />

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-4 border-t border-border py-2 text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          <span>{reactionTotal} reactions</span>
          <span>{commentCount} comments</span>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-around border-t border-b border-border py-2 dark:border-border-dark">
          {/* Reaction button */}
          <button
            ref={reactionBtnRef}
            type="button"
            onClick={handleOpenPicker}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              userReaction
                ? 'text-primary'
                : 'text-text-muted dark:text-text-muted-dark'
            )}
          >
            {userReaction ? (
              <span className="text-lg leading-none">{REACTION_EMOJI_MAP[userReaction]}</span>
            ) : (
              <Heart className="h-5 w-5" />
            )}
            <span>{userReaction ? userReaction.charAt(0).toUpperCase() + userReaction.slice(1) : 'React'}</span>
          </button>

          {/* Comment button */}
          <button
            type="button"
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>('input[placeholder*="comment"]');
              input?.focus();
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted dark:text-text-muted-dark"
          >
            <MessageSquare className="h-5 w-5" />
            <span>Comment</span>
          </button>

          {/* Bookmark button */}
          <button
            type="button"
            onClick={toggleBookmark}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              isBookmarked
                ? 'text-amber-500'
                : 'text-text-muted dark:text-text-muted-dark'
            )}
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-5 w-5" fill="currentColor" />
            ) : (
              <Bookmark className="h-5 w-5" />
            )}
            <span>{isBookmarked ? 'Saved' : 'Save'}</span>
          </button>
        </div>

        {/* Reaction picker */}
        <QuickReactionPicker
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleSelectReaction}
          anchorRect={pickerRect}
        />
      </div>

      {/* Comments section */}
      <div className="px-4 pt-2">
        <h2 className="mb-2 text-base font-semibold text-text dark:text-text-dark">
          Comments
        </h2>

        {commentsLoading && comments.length === 0 && (
          <div className="py-4 text-center text-sm text-text-muted dark:text-text-muted-dark">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        )}

        {!commentsLoading && comments.length === 0 && (
          <div className="py-6 text-center text-sm text-text-muted dark:text-text-muted-dark">
            No comments yet. Be the first to comment!
          </div>
        )}

        {comments.map((comment) => (
          <InlineCommentItem
            key={comment.id}
            comment={comment}
            postId={post.id}
            depth={0}
            onReply={(id) => {
              setReplyToId(id === replyToId ? null : id);
            }}
          />
        ))}

        {hasMore && !commentsLoading && (
          <button
            type="button"
            onClick={loadMore}
            className="my-2 w-full text-center text-sm font-medium text-primary"
          >
            Load more comments
          </button>
        )}

        {commentsLoading && comments.length > 0 && (
          <div className="py-2 text-center">
            <Loader2 className="mx-auto h-4 w-4 animate-spin text-text-muted" />
          </div>
        )}
      </div>

      {/* Fixed comment input at bottom */}
      {user && (
        <div className="fixed inset-x-0 z-20 border-t border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
          {replyToId && (
            <div className="mb-2 flex items-center justify-between text-xs text-text-muted dark:text-text-muted-dark">
              <span>
                Replying to comment
              </span>
              <button
                type="button"
                onClick={() => setReplyToId(null)}
                className="text-primary"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={replyToId ? 'Write a reply...' : 'Add a comment...'}
              maxLength={POST_COMMENT_MAX_LENGTH}
              className="flex-1 rounded-full border border-border bg-slate-50 px-4 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary dark:border-border-dark dark:bg-slate-800 dark:text-text-dark dark:placeholder:text-text-muted-dark"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handlePostComment();
                }
              }}
            />
            <button
              type="button"
              onClick={handlePostComment}
              disabled={!commentText.trim() || commentSubmitting}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white transition-opacity disabled:opacity-30"
              aria-label="Post comment"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
