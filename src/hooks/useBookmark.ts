'use client';

import { useState, useCallback } from 'react';

export function useBookmark(postId: number, initialBookmarked: boolean) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (loading) return;

    // Optimistic update
    const prev = isBookmarked;
    setIsBookmarked(!prev);
    setLoading(true);

    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ post_id: postId }),
      });

      if (!res.ok) {
        // Rollback on failure
        setIsBookmarked(prev);
      }
    } catch {
      // Rollback on error
      setIsBookmarked(prev);
    } finally {
      setLoading(false);
    }
  }, [postId, isBookmarked, loading]);

  return { isBookmarked, loading, toggle };
}
