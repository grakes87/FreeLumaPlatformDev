'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactionType } from '@/lib/utils/constants';

interface ReactionData {
  counts: Record<string, number>;
  total: number;
  user_reaction: ReactionType | null;
  comment_count: number;
}

interface UseVerseCategoryReactionsOptions {
  /** Initial user reaction passed from verse-by-category API to avoid extra GET on mount */
  initialUserReaction?: ReactionType | null;
  /** Initial reaction counts from verse-by-category API */
  initialCounts?: Record<string, number>;
  /** Initial total from verse-by-category API */
  initialTotal?: number;
  /** Initial comment count from verse-by-category API */
  initialCommentCount?: number;
}

export function useVerseCategoryReactions(
  verseCategoryContentId: number | null,
  options: UseVerseCategoryReactionsOptions = {}
) {
  const [counts, setCounts] = useState<Record<string, number>>(options.initialCounts ?? {});
  const [total, setTotal] = useState(options.initialTotal ?? 0);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(options.initialUserReaction ?? null);
  const [commentCount, setCommentCount] = useState(options.initialCommentCount ?? 0);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Track whether initial values were provided so we can skip the mount fetch
  const hasInitialData = useRef(
    options.initialCounts !== undefined || options.initialUserReaction !== undefined
  );

  const fetchReactions = useCallback(async () => {
    if (!verseCategoryContentId) return;
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/verse-category-reactions?verse_category_content_id=${verseCategoryContentId}`,
        { credentials: 'include', signal: controller.signal }
      );
      if (!res.ok) return;
      const raw = await res.json();
      const data: ReactionData = raw.data ?? raw;
      setCounts(data.counts);
      setTotal(data.total);
      setUserReaction(data.user_reaction);
      setCommentCount(data.comment_count);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[useVerseCategoryReactions] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [verseCategoryContentId]);

  // Sync state when a new verse is loaded with initial data
  useEffect(() => {
    if (options.initialCounts !== undefined) setCounts(options.initialCounts);
    if (options.initialTotal !== undefined) setTotal(options.initialTotal);
    if (options.initialUserReaction !== undefined) setUserReaction(options.initialUserReaction);
    if (options.initialCommentCount !== undefined) setCommentCount(options.initialCommentCount);
    hasInitialData.current =
      options.initialCounts !== undefined || options.initialUserReaction !== undefined;
  }, [verseCategoryContentId, options.initialCounts, options.initialTotal, options.initialUserReaction, options.initialCommentCount]);

  // Only auto-fetch on mount if no initial data was provided
  useEffect(() => {
    if (hasInitialData.current) {
      hasInitialData.current = false; // allow refetch next time
      return;
    }
    fetchReactions();
    return () => { abortRef.current?.abort(); };
  }, [fetchReactions]);

  const toggleReaction = useCallback(
    async (type: ReactionType) => {
      if (!verseCategoryContentId) return;

      // Optimistic update
      const prevCounts = { ...counts };
      const prevTotal = total;
      const prevUserReaction = userReaction;

      const newCounts = { ...counts };
      let newTotal = total;
      let newUserReaction: ReactionType | null;

      if (userReaction === type) {
        // Toggle off
        newCounts[type] = Math.max((newCounts[type] || 0) - 1, 0);
        if (newCounts[type] === 0) delete newCounts[type];
        newTotal = Math.max(newTotal - 1, 0);
        newUserReaction = null;
      } else {
        // Remove old reaction count if switching
        if (userReaction) {
          newCounts[userReaction] = Math.max((newCounts[userReaction] || 0) - 1, 0);
          if (newCounts[userReaction] === 0) delete newCounts[userReaction];
          newTotal = Math.max(newTotal - 1, 0);
        }
        // Add new reaction
        newCounts[type] = (newCounts[type] || 0) + 1;
        newTotal += 1;
        newUserReaction = type;
      }

      setCounts(newCounts);
      setTotal(newTotal);
      setUserReaction(newUserReaction);

      try {
        const res = await fetch('/api/verse-category-reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            verse_category_content_id: verseCategoryContentId,
            reaction_type: type,
          }),
        });
        if (!res.ok) throw new Error('Failed');
      } catch {
        // Rollback on failure
        setCounts(prevCounts);
        setTotal(prevTotal);
        setUserReaction(prevUserReaction);
      }
    },
    [verseCategoryContentId, counts, total, userReaction]
  );

  return {
    counts,
    total,
    userReaction,
    commentCount,
    loading,
    toggleReaction,
    refetch: fetchReactions,
  };
}
