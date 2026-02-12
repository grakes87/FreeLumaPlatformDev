'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export type FeedTab = 'fyp' | 'following';

export interface FeedAuthor {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

export interface FeedMedia {
  id: number;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  sort_order: number;
}

export interface FeedOriginalPost {
  id: number;
  body: string;
  deleted: boolean;
  author: FeedAuthor | null;
  media: FeedMedia[];
}

export interface FeedPost {
  id: number;
  user_id: number;
  body: string;
  post_type: 'text' | 'prayer_request';
  visibility: 'public' | 'followers';
  mode: 'bible' | 'positivity';
  edited: boolean;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  author: FeedAuthor | null;
  media: FeedMedia[];
  reaction_count: number;
  comment_count: number;
  repost_count: number;
  user_reaction: string | null;
  bookmarked: boolean;
  original_post: FeedOriginalPost | null;
}

interface FeedResponse {
  posts: FeedPost[];
  next_cursor: string | null;
  has_more: boolean;
}

/**
 * Feed hook managing FYP/Following tab state with cursor pagination,
 * pull-to-refresh, and local state mutation helpers.
 *
 * Default tab is 'fyp' per product context.
 */
export function useFeed() {
  const [activeTab, setActiveTabState] = useState<FeedTab>('fyp');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Track current tab to prevent stale responses from wrong tab
  const activeTabRef = useRef<FeedTab>(activeTab);

  const fetchPage = useCallback(
    async (tab: FeedTab, pageCursor: string | null, isRefresh: boolean) => {
      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const endpoint = tab === 'fyp' ? '/api/feed/fyp' : '/api/feed';
      const params = new URLSearchParams();
      if (pageCursor) params.set('cursor', pageCursor);
      params.set('limit', '20');

      const url = `${endpoint}?${params.toString()}`;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const res = await fetch(url, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Feed fetch failed: ${res.status}`);
        }

        const data: FeedResponse = await res.json();

        // Guard against stale response from a different tab
        if (activeTabRef.current !== tab) return;

        if (isRefresh || !pageCursor) {
          // First page or refresh: replace posts
          setPosts(data.posts);
        } else {
          // Append next page
          setPosts((prev) => {
            // Deduplicate by id in case of race conditions
            const existingIds = new Set(prev.map((p) => p.id));
            const newPosts = data.posts.filter((p) => !existingIds.has(p.id));
            return [...prev, ...newPosts];
          });
        }

        setCursor(data.next_cursor);
        setHasMore(data.has_more);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[useFeed] fetch error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Fetch first page on mount and when tab changes
  useEffect(() => {
    activeTabRef.current = activeTab;
    setPosts([]);
    setCursor(null);
    setHasMore(true);
    fetchPage(activeTab, null, false);

    return () => {
      abortRef.current?.abort();
    };
  }, [activeTab, fetchPage]);

  /**
   * Load the next page of posts. Only callable when not loading and hasMore.
   */
  const fetchNextPage = useCallback(() => {
    if (loading || refreshing || !hasMore) return;
    fetchPage(activeTab, cursor, false);
  }, [loading, refreshing, hasMore, activeTab, cursor, fetchPage]);

  /**
   * Pull-to-refresh: reset cursor and fetch fresh first page.
   */
  const refresh = useCallback(() => {
    setCursor(null);
    setHasMore(true);
    fetchPage(activeTab, null, true);
  }, [activeTab, fetchPage]);

  /**
   * Switch between FYP and Following tabs.
   * Triggers reset + fresh fetch via the useEffect dependency.
   */
  const setActiveTab = useCallback((tab: FeedTab) => {
    setActiveTabState(tab);
  }, []);

  /**
   * Remove a post from the local list (e.g., after deletion).
   */
  const removePost = useCallback((postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  /**
   * Update a post in the local list (e.g., after edit, reaction change).
   */
  const updatePost = useCallback((postId: number, updates: Partial<FeedPost>) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...updates } : p))
    );
  }, []);

  return {
    posts,
    loading,
    refreshing,
    hasMore,
    activeTab,
    fetchNextPage,
    refresh,
    setActiveTab,
    removePost,
    updatePost,
  };
}
