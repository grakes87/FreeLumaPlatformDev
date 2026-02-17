'use client';

import { useState, useCallback, useRef } from 'react';
import { COMMENT_MAX_LENGTH } from '@/lib/utils/constants';

export interface VerseCategoryCommentUser {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  is_verified: boolean;
}

export interface VerseCategoryComment {
  id: number;
  user_id: number;
  verse_category_content_id: number;
  parent_id: number | null;
  body: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
  user: VerseCategoryCommentUser;
  reply_count: number;
}

export function useVerseCategoryComments(
  verseCategoryContentId: number | null,
  parentId: number | null = null
) {
  const [comments, setComments] = useState<VerseCategoryComment[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const initialLoaded = useRef(false);

  const fetchComments = useCallback(
    async (offset = 0, limit = 10, append = false) => {
      if (!verseCategoryContentId) return;
      setLoading(true);

      try {
        const params = new URLSearchParams({
          verse_category_content_id: String(verseCategoryContentId),
          parent_id: parentId === null ? 'null' : String(parentId),
          limit: String(limit),
          offset: String(offset),
        });

        const res = await fetch(`/api/verse-category-comments?${params}`, {
          credentials: 'include',
        });
        if (!res.ok) return;

        const raw = await res.json();
        const data = raw.data ?? raw;
        setComments((prev) => (append ? [...prev, ...data.comments] : data.comments));
        setTotal(data.total);
        setHasMore(data.has_more);
        initialLoaded.current = true;
      } catch (err) {
        console.error('[useVerseCategoryComments] fetch error:', err);
      } finally {
        setLoading(false);
      }
    },
    [verseCategoryContentId, parentId]
  );

  const createComment = useCallback(
    async (body: string): Promise<VerseCategoryComment | null> => {
      if (!verseCategoryContentId) return null;
      if (body.length > COMMENT_MAX_LENGTH) return null;

      try {
        const res = await fetch('/api/verse-category-comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            verse_category_content_id: verseCategoryContentId,
            parent_id: parentId,
            body,
          }),
        });
        if (!res.ok) return null;

        const raw = await res.json();
        const newComment: VerseCategoryComment = raw.data ?? raw;
        setComments((prev) => [...prev, newComment]);
        setTotal((t) => t + 1);
        return newComment;
      } catch (err) {
        console.error('[useVerseCategoryComments] create error:', err);
        return null;
      }
    },
    [verseCategoryContentId, parentId]
  );

  const updateComment = useCallback(
    async (id: number, body: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/verse-category-comments/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ body }),
        });
        if (!res.ok) return false;

        const raw = await res.json();
        const data = raw.data ?? raw;
        setComments((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, body: data.body, edited: data.edited } : c
          )
        );
        return true;
      } catch (err) {
        console.error('[useVerseCategoryComments] update error:', err);
        return false;
      }
    },
    []
  );

  const deleteComment = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const res = await fetch(`/api/verse-category-comments/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) return false;

        setComments((prev) => prev.filter((c) => c.id !== id));
        setTotal((t) => Math.max(t - 1, 0));
        return true;
      } catch (err) {
        console.error('[useVerseCategoryComments] delete error:', err);
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
