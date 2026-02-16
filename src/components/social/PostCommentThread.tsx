'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, CornerDownRight, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { usePostComments, type PostComment } from '@/hooks/usePostComments';
import { POST_COMMENT_MAX_LENGTH } from '@/lib/utils/constants';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { UserAvatar } from '@/components/ui/UserAvatar';

// ---- Relative time helper ----
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

// ---- Avatar ----
function Avatar({ user }: { user: PostComment['user'] }) {
  return (
    <UserAvatar
      src={user.avatar_url}
      name={user.display_name}
      color={user.avatar_color}
      size={32}
    />
  );
}

// ---- Reply section (nested) ----
function ReplySection({
  commentId,
  postId,
  replyCount,
  initialReplies,
}: {
  commentId: number;
  postId: number;
  replyCount: number;
  initialReplies: PostComment[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies] = useState<PostComment[]>(initialReplies);
  const [hasMoreReplies, setHasMoreReplies] = useState(replyCount > initialReplies.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const { loadReplies, editComment, deleteComment } = usePostComments(postId, commentId);

  // Sync newly added replies from parent state
  useEffect(() => {
    setReplies((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const newOnes = initialReplies.filter((r) => !existingIds.has(r.id));
      if (newOnes.length === 0) return prev;
      return [...prev, ...newOnes];
    });
    // Auto-expand when a reply is added
    if (initialReplies.length > 0) {
      setExpanded(true);
    }
  }, [initialReplies]);

  const handleExpand = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
      // If we don't have all replies, fetch them
      if (replies.length === 0 && replyCount > 0) {
        setLoadingMore(true);
        loadReplies(commentId, 10).then((fetched) => {
          setReplies(fetched);
          setHasMoreReplies(fetched.length < replyCount);
          setLoadingMore(false);
        });
      }
    } else {
      setExpanded(false);
    }
  }, [expanded, replies.length, replyCount, loadReplies, commentId]);

  const handleLoadMore = useCallback(() => {
    setLoadingMore(true);
    // Use cursor-based approach — pass last reply's id conceptually via the parent fetch
    loadReplies(commentId, 20).then((fetched) => {
      setReplies(fetched);
      setHasMoreReplies(false); // loaded all
      setLoadingMore(false);
    });
  }, [loadReplies, commentId]);

  const handleEdit = useCallback(
    async (id: number, body: string) => {
      const ok = await editComment(id, body);
      if (ok) {
        setReplies((prev) =>
          prev.map((r) => (r.id === id ? { ...r, body, edited: true } : r))
        );
      }
      return ok;
    },
    [editComment]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await deleteComment(id);
      if (ok) {
        setReplies((prev) => prev.filter((r) => r.id !== id));
      }
      return ok;
    },
    [deleteComment]
  );

  if (replyCount === 0 && !expanded) return null;

  return (
    <div className="ml-10 mt-1">
      {!expanded && replyCount > 0 && (
        <button
          type="button"
          onClick={handleExpand}
          className="flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white"
        >
          <ChevronDown className="h-3 w-3" />
          {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
        </button>
      )}

      {expanded && (
        <>
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              depth={1}
              onUpdate={handleEdit}
              onDelete={handleDelete}
            />
          ))}
          {loadingMore && (
            <div className="py-2 text-center text-xs text-white/40">
              Loading...
            </div>
          )}
          {hasMoreReplies && !loadingMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              className="text-xs font-medium text-white/70 hover:text-white"
            >
              Load more replies
            </button>
          )}
          {expanded && replyCount > 0 && (
            <button
              type="button"
              onClick={handleExpand}
              className="mt-1 text-xs text-white/40 hover:text-white/60"
            >
              Hide replies
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ---- Single comment item ----
function CommentItem({
  comment,
  postId,
  depth,
  onUpdate,
  onDelete,
  onReply,
}: {
  comment: PostComment;
  postId: number;
  depth: number;
  onUpdate: (id: number, body: string) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onReply?: (commentId: number) => void;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body);

  const isOwner = user?.id === comment.user_id;

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    const ok = await onUpdate(comment.id, editText.trim());
    if (ok) setEditing(false);
  };

  const handleDelete = async () => {
    await onDelete(comment.id);
  };

  return (
    <div
      className={cn(
        'flex gap-2 py-2',
        depth > 0 && 'border-l-2 border-white/15 pl-3'
      )}
    >
      <div className="flex-shrink-0 pt-0.5">
        <Avatar user={comment.user} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-white">
            {comment.user.display_name}
          </span>
          {comment.user.is_verified && <VerifiedBadge className="h-3.5 w-3.5 shrink-0 text-blue-400" />}
          <span className="text-xs text-white/40">
            {relativeTime(comment.created_at)}
          </span>
          {comment.edited && (
            <span className="text-xs italic text-white/40">
              edited
            </span>
          )}
        </div>

        {editing ? (
          <div className="mt-1 flex gap-1">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={POST_COMMENT_MAX_LENGTH}
              className="flex-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleSaveEdit}
              className="rounded-lg px-2 py-1 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white"
            >
              Save
            </button>
          </div>
        ) : (
          <p className="mt-0.5 text-sm text-white/80 break-words">
            {comment.body}
          </p>
        )}

        {/* Actions */}
        {!editing && (
          <div className="mt-1 flex gap-3">
            {depth === 0 && onReply && (
              <button
                type="button"
                onClick={() => onReply(comment.id)}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70"
              >
                <CornerDownRight className="h-3 w-3" />
                Reply
              </button>
            )}
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => { setEditText(comment.body); setEditing(true); }}
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {/* Replies (only for root comments) */}
        {depth === 0 && (
          <ReplySection
            commentId={comment.id}
            postId={postId}
            replyCount={comment.reply_count}
            initialReplies={comment.replies || []}
          />
        )}
      </div>
    </div>
  );
}

// ---- Inline reply input ----
function InlineReplyInput({
  postId,
  parentId,
  value,
  onChange,
  onPosted,
}: {
  postId: number;
  parentId: number;
  value: string;
  onChange: (v: string) => void;
  onPosted: (newReply: PostComment) => void;
}) {
  const { addComment, submitting } = usePostComments(postId);

  const handlePost = async () => {
    const text = value.trim();
    if (!text) return;
    const result = await addComment(text, parentId);
    if (result) onPosted(result);
  };

  return (
    <div className="ml-10 mt-1 mb-2 flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Reply..."
        maxLength={POST_COMMENT_MAX_LENGTH}
        className="flex-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handlePost();
          }
        }}
        autoFocus
      />
      <button
        type="button"
        onClick={handlePost}
        disabled={!value.trim() || submitting}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-opacity disabled:opacity-30"
        aria-label="Post reply"
      >
        <Send className="h-3 w-3" />
      </button>
    </div>
  );
}

// ---- Main thread ----
interface PostCommentThreadProps {
  postId: number;
  onCommentCountChange?: (delta: number) => void;
}

export function PostCommentThread({ postId, onCommentCountChange }: PostCommentThreadProps) {
  const { user, isAuthenticated } = useAuth();
  const {
    comments,
    hasMore,
    loading,
    submitting,
    initialLoaded,
    fetchComments,
    loadMore,
    addComment,
    addReplyToComment,
    editComment,
    deleteComment,
  } = usePostComments(postId);

  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyInputText, setReplyInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial fetch
  useEffect(() => {
    if (!initialLoaded) {
      fetchComments(null, 10);
    }
  }, [fetchComments, initialLoaded]);

  const handlePost = async () => {
    const text = inputText.trim();
    if (!text) return;
    const result = await addComment(text);
    if (result) {
      setInputText('');
      onCommentCountChange?.(1);
      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await deleteComment(id);
    if (ok) onCommentCountChange?.(-1);
    return ok;
  };

  const handleReply = (commentId: number) => {
    setReplyTo((prev) => (prev === commentId ? null : commentId));
    setReplyInputText('');
  };

  return (
    <>
      {/* Scrollable comment list */}
      <div ref={scrollRef} data-scroll className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {loading && comments.length === 0 && (
          <div className="py-8 text-center text-sm text-white/40">
            Loading comments...
          </div>
        )}

        {!loading && comments.length === 0 && (
          <div className="py-8 text-center text-sm text-white/40">
            No comments yet. Be the first!
          </div>
        )}

        {comments.map((comment) => (
          <div key={comment.id}>
            <CommentItem
              comment={comment}
              postId={postId}
              depth={0}
              onUpdate={editComment}
              onDelete={handleDelete}
              onReply={isAuthenticated ? handleReply : undefined}
            />

            {/* Inline reply input */}
            {replyTo === comment.id && isAuthenticated && (
              <InlineReplyInput
                postId={postId}
                parentId={comment.id}
                value={replyInputText}
                onChange={setReplyInputText}
                onPosted={(newReply) => {
                  setReplyTo(null);
                  setReplyInputText('');
                  onCommentCountChange?.(1);
                  addReplyToComment(comment.id, newReply);
                }}
              />
            )}
          </div>
        ))}

        {hasMore && !loading && (
          <button
            type="button"
            onClick={loadMore}
            className="my-2 w-full text-center text-sm font-medium text-white/70 hover:text-white"
          >
            Load more comments
          </button>
        )}

        {loading && comments.length > 0 && (
          <div className="py-2 text-center text-xs text-white/40">
            Loading...
          </div>
        )}
      </div>

      {/* Bottom input */}
      <div className="border-t border-white/10 px-4 py-3">
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Add a comment..."
              maxLength={POST_COMMENT_MAX_LENGTH}
              className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handlePost();
                }
              }}
            />
            <button
              type="button"
              onClick={handlePost}
              disabled={!inputText.trim() || submitting}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-opacity disabled:opacity-30"
              aria-label="Post comment"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-white/50">
            <a href="/login" className="font-medium text-white/80 hover:text-white hover:underline">
              Sign in
            </a>{' '}
            to comment
          </p>
        )}
      </div>
    </>
  );
}
