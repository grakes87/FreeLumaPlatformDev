'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface WorkshopHost {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
}

export interface WorkshopCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WorkshopRsvp {
  status: string;
  is_co_host: boolean;
  can_speak: boolean;
}

export interface Workshop {
  id: number;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: 'scheduled' | 'lobby' | 'live' | 'ended';
  is_private: boolean;
  max_capacity: number | null;
  attendee_count: number;
  agora_channel: string | null;
  host_id: number;
  category_id: number | null;
  series_id: number | null;
  recording_url: string | null;
  actual_started_at: string | null;
  actual_ended_at: string | null;
  created_at: string;
  host: WorkshopHost;
  category: WorkshopCategory | null;
  user_rsvp: WorkshopRsvp | null;
  is_host: boolean;
}

interface WorkshopsResponse {
  workshops: Workshop[];
  nextCursor: number | null;
}

export interface UseWorkshopsOptions {
  category?: number;
  past?: boolean;
  my?: boolean;
  host?: number;
}

/**
 * Hook for fetching and paginating workshop listings with filter support.
 *
 * Follows the same cursor-based pagination pattern as useFeed/usePrayerWall.
 */
export function useWorkshops(options?: UseWorkshopsOptions) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Serialize options for dependency tracking
  const optionsKey = JSON.stringify(options ?? {});

  const fetchPage = useCallback(
    async (pageCursor: number | null, isRefresh: boolean) => {
      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const params = new URLSearchParams();
      params.set('limit', '20');

      if (pageCursor) params.set('cursor', String(pageCursor));

      const opts: UseWorkshopsOptions = options ?? {};
      if (opts.category) params.set('category', String(opts.category));
      if (opts.past) params.set('past', 'true');
      if (opts.my) params.set('my', 'true');
      if (opts.host) params.set('host', String(opts.host));

      const url = `/api/workshops?${params.toString()}`;

      try {
        if (!isRefresh) {
          setLoading(true);
        }
        setError(null);

        const res = await fetch(url, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch workshops: ${res.status}`);
        }

        const data: WorkshopsResponse = await res.json();

        if (isRefresh || !pageCursor) {
          setWorkshops(data.workshops);
        } else {
          setWorkshops((prev) => {
            const existingIds = new Set(prev.map((w) => w.id));
            const newWorkshops = data.workshops.filter((w) => !existingIds.has(w.id));
            return [...prev, ...newWorkshops];
          });
        }

        setCursor(data.nextCursor);
        setHasMore(data.nextCursor !== null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[useWorkshops] fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workshops');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optionsKey]
  );

  // Fetch first page on mount and when options change
  useEffect(() => {
    setWorkshops([]);
    setCursor(null);
    setHasMore(true);
    fetchPage(null, false);

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    fetchPage(cursor, false);
  }, [loading, hasMore, cursor, fetchPage]);

  const refresh = useCallback(() => {
    setCursor(null);
    setHasMore(true);
    fetchPage(null, true);
  }, [fetchPage]);

  return {
    workshops,
    isLoading: loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
