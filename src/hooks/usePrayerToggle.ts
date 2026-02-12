'use client';

import { useState, useCallback } from 'react';

interface UsePrayerToggleReturn {
  isPraying: boolean;
  prayCount: number;
  loading: boolean;
  toggle: () => Promise<void>;
}

/**
 * Hook to manage pray/unpray toggle with optimistic updates.
 * Uses POST /api/prayer-requests/[id]/pray for atomic toggle.
 */
export function usePrayerToggle(
  prayerRequestId: number,
  initialPraying: boolean,
  initialCount: number
): UsePrayerToggleReturn {
  const [isPraying, setIsPraying] = useState(initialPraying);
  const [prayCount, setPrayCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (loading) return;

    // Save previous state for rollback
    const prevIsPraying = isPraying;
    const prevPrayCount = prayCount;

    // Optimistic update
    setIsPraying(!isPraying);
    setPrayCount(isPraying ? Math.max(prayCount - 1, 0) : prayCount + 1);
    setLoading(true);

    try {
      const res = await fetch(`/api/prayer-requests/${prayerRequestId}/pray`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to toggle prayer support');
      }

      const data: { action: 'added' | 'removed'; pray_count: number } = await res.json();

      // Sync with server state
      setIsPraying(data.action === 'added');
      setPrayCount(data.pray_count);
    } catch {
      // Rollback on error
      setIsPraying(prevIsPraying);
      setPrayCount(prevPrayCount);
    } finally {
      setLoading(false);
    }
  }, [prayerRequestId, isPraying, prayCount, loading]);

  return { isPraying, prayCount, loading, toggle };
}
