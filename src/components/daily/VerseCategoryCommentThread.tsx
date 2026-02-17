'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, CornerDownRight, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { useVerseCategoryComments, type VerseCategoryComment } from '@/hooks/useVerseCategoryComments';
import { COMMENT_MAX_LENGTH } from '@/lib/utils/constants';
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
function Avatar({ user }: { user: VerseCategoryComment['user'] }) {
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
  verseCategoryContentId,
  replyCount,
}: {
  commentId: number;
  verseCategoryContentId: number;
  replyCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { comments: replies, hasMore, loading, fetchComments, updateComment, deleteComment } =
    useVerseCategoryComments(verseCategoryContentId, commentId);

  const handleExpand = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
      fetchComments(0, 3);
    } else {
      setExpanded(false);
    }
  }, [expanded, fetchComments]);

  const handleLoadMore = useCallback(() => {
    fetchComments(replies.length, 10, true);
  }, [fetchComments, replies.length]);

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
              verseCategoryContentId={verseCategoryContentId}
              depth={1}
              onUpdate={updateComment}
              onDelete={deleteComment}
            />
          ))}
          {loading && (
            <div className="py-2 text-center text-xs text-white/40">
              Loading...
            </div>
          )}
          {hasMore && !loading && (
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
  verseCategoryContentId,
  depth,
  onUpdate,
  onDelete,
  onReply,
}: {
  comment: VerseCategoryComment;
  verseCategoryContentId: number;
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
              maxLength={COMMENT_MAX_LENGTH}
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

        {/* Replies */}
        {depth === 0 && (
          <ReplySection
            commentId={comment.id}
            verseCategoryContentId={verseCategoryContentId}
            replyCount={comment.reply_count}
          />
        )}
      </div>
    </div>
  );
}

// ---- Main thread ----
interface VerseCategoryCommentThreadProps {
  verseCategoryContentId: number;
  onCommentCountChange?: (delta: number) => void;
}

export function VerseCategoryCommentThread({
  verseCategoryContentId,
  onCommentCountChange,
}: VerseCategoryCommentThreadProps) {
  const { user, isAuthenticated } = useAuth();
  const {
    comments,
    total,
    hasMore,
    loading,
    initialLoaded,
    fetchComments,
    createComment,
    updateComment,
    deleteComment,
  } = useVerseCategoryComments(verseCategoryContentId);

  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyInputText, setReplyInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial fetch
  useEffect(() => {
    if (!initialLoaded) {
      fetchComments(0, 10);
    }
  }, [fetchComments, initialLoaded]);

  const handlePost = async () => {
    const text = inputText.trim();
    if (!text) return;
    const result = await createComment(text);
    if (result) {
      setInputText('');
      onCommentCountChange?.(1);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  };

  const handleLoadMore = () => {
    fetchComments(comments.length, 10, true);
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
      <div ref={scrollRef} data-scroll className="flex-1 overflow-y-auto px-4 pb-2">
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
              verseCategoryContentId={verseCategoryContentId}
              depth={0}
              onUpdate={updateComment}
              onDelete={handleDelete}
              onReply={isAuthenticated ? handleReply : undefined}
            />

            {/* Inline reply input */}
            {replyTo === comment.id && isAuthenticated && (
              <InlineReplyInput
                verseCategoryContentId={verseCategoryContentId}
                parentId={comment.id}
                value={replyInputText}
                onChange={setReplyInputText}
                onPosted={() => {
                  setReplyTo(null);
                  setReplyInputText('');
                  onCommentCountChange?.(1);
                }}
              />
            )}
          </div>
        ))}

        {hasMore && !loading && (
          <button
            type="button"
            onClick={handleLoadMore}
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
              maxLength={COMMENT_MAX_LENGTH}
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
              disabled={!inputText.trim()}
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

// ---- Inline reply input ----
function InlineReplyInput({
  verseCategoryContentId,
  parentId,
  value,
  onChange,
  onPosted,
}: {
  verseCategoryContentId: number;
  parentId: number;
  value: string;
  onChange: (v: string) => void;
  onPosted: () => void;
}) {
  const { createComment } = useVerseCategoryComments(verseCategoryContentId, parentId);

  const handlePost = async () => {
    const text = value.trim();
    if (!text) return;
    const result = await createComment(text);
    if (result) onPosted();
  };

  return (
    <div className="ml-10 mt-1 mb-2 flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Reply..."
        maxLength={COMMENT_MAX_LENGTH}
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
        disabled={!value.trim()}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-opacity disabled:opacity-30"
        aria-label="Post reply"
      >
        <Send className="h-3 w-3" />
      </button>
    </div>
  );
}
