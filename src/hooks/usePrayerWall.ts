'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type PrayerTab = 'others' | 'my_requests' | 'my_joined';
export type PrayerStatusFilter = 'all' | 'active' | 'answered';

export interface PrayerAuthor {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

export interface PrayerMedia {
  id: number;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  sort_order: number;
}

export interface PrayerPost {
  id: number;
  body: string;
  user_id: number;
  is_anonymous: boolean;
  edited: boolean;
  flagged: boolean;
  created_at: string;
  updated_at: string;
  user: PrayerAuthor;
  media: PrayerMedia[];
}

export interface PrayerItem {
  id: number;
  post_id: number;
  privacy: 'public' | 'followers' | 'private';
  status: 'active' | 'answered';
  answered_at: string | null;
  answered_testimony: string | null;
  pray_count: number;
  created_at: string;
  updated_at: string;
  post: PrayerPost;
  is_praying: boolean;
}

interface PrayerWallResponse {
  prayers: PrayerItem[];
  next_cursor: string | null;
  has_more: boolean;
}

interface UsePrayerWallReturn {
  prayers: PrayerItem[];
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  activeTab: PrayerTab;
  statusFilter: PrayerStatusFilter;
  setActiveTab: (tab: PrayerTab) => void;
  setStatusFilter: (filter: PrayerStatusFilter) => void;
  fetchNextPage: () => Promise<void>;
  refresh: () => Promise<void>;
  removePrayer: (id: number) => void;
  updatePrayer: (id: number, updates: Partial<PrayerItem>) => void;
}

/**
 * Hook to manage prayer wall feed state with tabs, filters, and cursor pagination.
 */
export function usePrayerWall(): UsePrayerWallReturn {
  const [prayers, setPrayers] = useState<PrayerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [activeTab, setActiveTabState] = useState<PrayerTab>('others');
  const [statusFilter, setStatusFilterState] = useState<PrayerStatusFilter>('all');

  const abortRef = useRef<AbortController | null>(null);

  const fetchPrayers = useCallback(
    async (opts: { reset?: boolean; isRefresh?: boolean } = {}) => {
      const { reset = false, isRefresh = false } = opts;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (reset) {
        setLoading(true);
      }
      if (isRefresh) {
        setRefreshing(true);
      }

      const currentCursor = reset ? null : cursor;
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      params.set('status', statusFilter);
      params.set('limit', '20');
      if (currentCursor) {
        params.set('cursor', currentCursor);
      }

      try {
        const res = await fetch(`/api/prayer-requests?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!res.ok) {
          // Silently fail (403 for positivity mode is expected)
          if (reset) setPrayers([]);
          setHasMore(false);
          return;
        }

        const data: PrayerWallResponse = await res.json();

        if (reset) {
          setPrayers(data.prayers);
        } else {
          setPrayers((prev) => [...prev, ...data.prayers]);
        }

        setCursor(data.next_cursor);
        setHasMore(data.has_more);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[usePrayerWall] fetch error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, statusFilter, cursor]
  );

  // Reset and fetch on mount and when tab or filter changes
  useEffect(() => {
    setCursor(null);
    fetchPrayers({ reset: true });

    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, statusFilter]);

  const fetchNextPage = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchPrayers();
  }, [hasMore, loading, fetchPrayers]);

  const refresh = useCallback(async () => {
    setCursor(null);
    await fetchPrayers({ reset: true, isRefresh: true });
  }, [fetchPrayers]);

  const setActiveTab = useCallback((tab: PrayerTab) => {
    setActiveTabState(tab);
  }, []);

  const setStatusFilter = useCallback((filter: PrayerStatusFilter) => {
    setStatusFilterState(filter);
  }, []);

  const removePrayer = useCallback((id: number) => {
    setPrayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePrayer = useCallback((id: number, updates: Partial<PrayerItem>) => {
    setPrayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  return {
    prayers,
    loading,
    refreshing,
    hasMore,
    activeTab,
    statusFilter,
    setActiveTab,
    setStatusFilter,
    fetchNextPage,
    refresh,
    removePrayer,
    updatePrayer,
  };
}
