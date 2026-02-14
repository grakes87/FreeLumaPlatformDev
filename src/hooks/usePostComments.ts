'use client';

import { useState, useCallback, useRef } from 'react';

export interface PostCommentUser {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  is_verified: boolean;
}

export interface PostComment {
  id: number;
  user_id: number;
  post_id: number;
  parent_id: number | null;
  body: string;
  edited: boolean;
  flagged: boolean;
  created_at: string;
  updated_at: string;
  user: PostCommentUser;
  reply_count: number;
  replies: PostComment[];
}

export function usePostComments(
  postId: number | null,
  parentId: number | null = null
) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const nextCursor = useRef<string | null>(null);
  const initialLoaded = useRef(false);

  const fetchComments = useCallback(
    async (cursor?: string | null, limit = 10, append = false) => {
      if (!postId) return;
      setLoading(true);

      try {
        const params = new URLSearchParams({
          post_id: String(postId),
          parent_id: parentId === null ? 'null' : String(parentId),
          limit: String(limit),
        });

        if (cursor) {
          params.set('cursor', cursor);
        }

        const res = await fetch(`/api/post-comments?${params}`, {
          credentials: 'include',
        });
        if (!res.ok) return;

        const data = await res.json();
        setComments((prev) => (append ? [...prev, ...data.comments] : data.comments));
        setHasMore(data.has_more);
        nextCursor.current = data.next_cursor;
        initialLoaded.current = true;
      } catch (err) {
        console.error('[usePostComments] fetch error:', err);
      } finally {
        setLoading(false);
      }
    },
    [postId, parentId]
  );

  const loadMore = useCallback(() => {
    if (nextCursor.current) {
      fetchComments(nextCursor.current, 10, true);
    }
  }, [fetchComments]);

  const loadReplies = useCallback(
    async (commentId: number, limit = 10) => {
      if (!postId) return [];

      try {
        const params = new URLSearchParams({
          post_id: String(postId),
          parent_id: String(commentId),
          limit: String(limit),
        });

        const res = await fetch(`/api/post-comments?${params}`, {
          credentials: 'include',
        });
        if (!res.ok) return [];

        const data = await res.json();
        return data.comments as PostComment[];
      } catch (err) {
        console.error('[usePostComments] loadReplies error:', err);
        return [];
      }
    },
    [postId]
  );

  const addComment = useCallback(
    async (body: string, replyToId?: number | null): Promise<PostComment | null> => {
      if (!postId) return null;
      setSubmitting(true);

      try {
        const res = await fetch('/api/post-comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            post_id: postId,
            parent_id: replyToId ?? parentId,
            body,
          }),
        });
        if (!res.ok) return null;

        const newComment: PostComment = await res.json();

        if (!replyToId && parentId === null) {
          // Root-level comment — add to main list
          setComments((prev) => [...prev, newComment]);
        }

        return newComment;
      } catch (err) {
        console.error('[usePostComments] add error:', err);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [postId, parentId]
  );

  const addReplyToComment = useCallback(
    (parentId: number, reply: PostComment) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? {
                ...c,
                reply_count: c.reply_count + 1,
                replies: [...(c.replies || []), reply],
              }
            : c
        )
      );
    },
    []
  );

  const editComment = useCallback(
    async (id: number, body: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/post-comments/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ body }),
        });
        if (!res.ok) return false;

        const data = await res.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, body: data.body, edited: data.edited } : c
          )
        );
        return true;
      } catch (err) {
        console.error('[usePostComments] edit error:', err);
        return false;
      }
    },
    []
  );

  const deleteComment = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const res = await fetch(`/api/post-comments/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) return false;

        setComments((prev) => prev.filter((c) => c.id !== id));
        return true;
      } catch (err) {
        console.error('[usePostComments] delete error:', err);
        return false;
      }
    },
    []
  );

  return {
    comments,
    hasMore,
    loading,
    submitting,
    initialLoaded: initialLoaded.current,
    fetchComments,
    loadMore,
    loadReplies,
    addComment,
    addReplyToComment,
    editComment,
    deleteComment,
  };
}
