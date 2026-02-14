'use client';

import { useState, useCallback, useRef } from 'react';
import type { ReactionType } from '@/lib/utils/constants';

interface UseVideoReactionsOptions {
  videoId: number;
  initialCounts?: Record<string, number>;
  initialTotal?: number;
  initialUserReaction?: ReactionType | null;
}

/**
 * Hook for video reactions — follows usePostReactions pattern exactly.
 * Optimistic toggle with rollback on error.
 */
export function useVideoReactions({
  videoId,
  initialCounts = {},
  initialTotal = 0,
  initialUserReaction = null,
}: UseVideoReactionsOptions) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [total, setTotal] = useState(initialTotal);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(initialUserReaction);
  const pendingRef = useRef(false);

  const toggleReaction = useCallback(
    async (type: ReactionType) => {
      if (pendingRef.current) return;
      pendingRef.current = true;

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
        const res = await fetch('/api/video-reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ video_id: videoId, reaction_type: type }),
        });
        if (!res.ok) throw new Error('Failed');
      } catch {
        // Rollback on failure
        setCounts(prevCounts);
        setTotal(prevTotal);
        setUserReaction(prevUserReaction);
      } finally {
        pendingRef.current = false;
      }
    },
    [videoId, counts, total, userReaction]
  );

  return { counts, total, userReaction, toggleReaction };
}
