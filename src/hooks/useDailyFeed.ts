'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { detectTimezone } from '@/lib/utils/timezone';
import { LANGUAGES } from '@/lib/utils/constants';
import type { DailyContentData } from './useDailyContent';

function getLanguageCookie(): string {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/(?:^|; )preferred_language=([a-z]{2})/);
  const val = match?.[1] ?? 'en';
  return (LANGUAGES as readonly string[]).includes(val) ? val : 'en';
}

interface DailyFeedResponse {
  days: DailyContentData[];
  next_cursor: string | null;
  has_more: boolean;
}

/** Max days to keep in memory. Older entries are trimmed from front when exceeded. */
const MAX_DAYS_IN_MEMORY = 30;

export function useDailyFeed(mode?: string) {
  const [days, setDays] = useState<DailyContentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** How many items were trimmed from the front on the last append. Component reads this to adjust scroll. */
  const frontTrimRef = useRef(0);

  const fetchPage = useCallback(
    async (pageCursor: string | null, isRefresh: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const tz = detectTimezone();
      const params = new URLSearchParams();
      params.set('timezone', tz);
      params.set('limit', '5');
      if (pageCursor) params.set('cursor', pageCursor);

      // Include language cookie for guest users
      const lang = getLanguageCookie();
      if (lang !== 'en') params.set('language', lang);
      if (mode) params.set('mode', mode);

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const res = await fetch(`/api/daily-posts/feed?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Feed fetch failed: ${res.status}`);
        }

        const data: DailyFeedResponse = await res.json();

        if (isRefresh || !pageCursor) {
          frontTrimRef.current = 0;
          setDays(data.days);
        } else {
          setDays((prev) => {
            const existingIds = new Set(prev.map((d) => d.id));
            const newDays = data.days.filter((d) => !existingIds.has(d.id));
            const combined = [...prev, ...newDays];
            // Sliding window: trim oldest entries to cap memory usage
            if (combined.length > MAX_DAYS_IN_MEMORY) {
              const trimCount = combined.length - MAX_DAYS_IN_MEMORY;
              frontTrimRef.current = trimCount;
              return combined.slice(trimCount);
            }
            frontTrimRef.current = 0;
            return combined;
          });
        }

        setCursor(data.next_cursor);
        setHasMore(data.has_more);
        retryCountRef.current = 0;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[useDailyFeed] fetch error:', err);
        // Auto-retry on initial load failure (e.g. auth not ready on mobile reload)
        if (!pageCursor && retryCountRef.current < 3) {
          retryCountRef.current++;
          const delay = retryCountRef.current * 1500;
          retryTimerRef.current = setTimeout(() => fetchPage(null, false), delay);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mode]
  );

  // Fetch first page on mount
  useEffect(() => {
    fetchPage(null, false);
    return () => {
      abortRef.current?.abort();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchPage]);

  const fetchNextPage = useCallback(() => {
    if (loading || refreshing || !hasMore) return;
    fetchPage(cursor, false);
  }, [loading, refreshing, hasMore, cursor, fetchPage]);

  const refresh = useCallback(() => {
    setCursor(null);
    setHasMore(true);
    fetchPage(null, true);
  }, [fetchPage]);

  return { days, loading, refreshing, hasMore, fetchNextPage, refresh, frontTrimRef };
}
