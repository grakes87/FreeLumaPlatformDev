'use client';

import { useState, useCallback, useRef } from 'react';

export interface CommentUser {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  is_verified: boolean;
}

export interface Comment {
  id: number;
  user_id: number;
  daily_content_id: number;
  parent_id: number | null;
  body: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
  user: CommentUser;
  reply_count: number;
}

export function useComments(
  dailyContentId: number | null,
  parentId: number | null = null
) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const initialLoaded = useRef(false);

  const fetchComments = useCallback(
    async (offset = 0, limit = 10, append = false) => {
      if (!dailyContentId) return;
      setLoading(true);

      try {
        const params = new URLSearchParams({
          daily_content_id: String(dailyContentId),
          parent_id: parentId === null ? 'null' : String(parentId),
          limit: String(limit),
          offset: String(offset),
        });

        const res = await fetch(`/api/daily-comments?${params}`, {
          credentials: 'include',
        });
        if (!res.ok) return;

        const data = await res.json();
        setComments((prev) => (append ? [...prev, ...data.comments] : data.comments));
        setTotal(data.total);
        setHasMore(data.has_more);
        initialLoaded.current = true;
      } catch (err) {
        console.error('[useComments] fetch error:', err);
      } finally {
        setLoading(false);
      }
    },
    [dailyContentId, parentId]
  );

  const createComment = useCallback(
    async (body: string): Promise<Comment | null> => {
      if (!dailyContentId) return null;

      try {
        const res = await fetch('/api/daily-comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            daily_content_id: dailyContentId,
            parent_id: parentId,
            body,
          }),
        });
        if (!res.ok) return null;

        const newComment: Comment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setTotal((t) => t + 1);
        return newComment;
      } catch (err) {
        console.error('[useComments] create error:', err);
        return null;
      }
    },
    [dailyContentId, parentId]
  );

  const updateComment = useCallback(
    async (id: number, body: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/daily-comments/${id}`, {
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
        console.error('[useComments] update error:', err);
        return false;
      }
    },
    []
  );

  const deleteComment = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const res = await fetch(`/api/daily-comments/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) return false;

        setComments((prev) => prev.filter((c) => c.id !== id));
        setTotal((t) => Math.max(t - 1, 0));
        return true;
      } catch (err) {
        console.error('[useComments] delete error:', err);
        return false;
      }
    },
    []
  );

  return {
    comments,
    total,
    hasMore,
    loading,
    initialLoaded: initialLoaded.current,
    fetchComments,
    createComment,
    updateComment,
    deleteComment,
  };
}
