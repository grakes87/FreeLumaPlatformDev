'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactionType } from '@/lib/utils/constants';

interface ReactionData {
  counts: Record<string, number>;
  total: number;
  user_reaction: ReactionType | null;
  comment_count: number;
}

export function useReactions(dailyContentId: number | null) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchReactions = useCallback(async () => {
    if (!dailyContentId) return;
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/daily-reactions?daily_content_id=${dailyContentId}`,
        { credentials: 'include', signal: controller.signal }
      );
      if (!res.ok) return;
      const data: ReactionData = await res.json();
      setCounts(data.counts);
      setTotal(data.total);
      setUserReaction(data.user_reaction);
      setCommentCount(data.comment_count);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[useReactions] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [dailyContentId]);

  useEffect(() => {
    fetchReactions();
    return () => { abortRef.current?.abort(); };
  }, [fetchReactions]);

  const toggleReaction = useCallback(
    async (type: ReactionType) => {
      if (!dailyContentId) return;

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
        const res = await fetch('/api/daily-reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ daily_content_id: dailyContentId, reaction_type: type }),
        });
        if (!res.ok) throw new Error('Failed');
      } catch {
        // Rollback on failure
        setCounts(prevCounts);
        setTotal(prevTotal);
        setUserReaction(prevUserReaction);
      }
    },
    [dailyContentId, counts, total, userReaction]
  );

  return { counts, total, userReaction, commentCount, loading, toggleReaction, refetch: fetchReactions };
}
