'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FollowStatus } from './useFollow';

export interface SearchResult {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string | null;
  follow_status: FollowStatus;
}

interface UseUserSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook for user search with 400ms debounce.
 * Requires minimum 2 characters to trigger search.
 * Returns results with follow status for each user.
 */
export function useUserSearch(): UseUserSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(q)}`,
        { credentials: 'include', signal: controller.signal }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Search failed');
      }

      const data = await res.json();
      setResults(data.users || []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Show loading state immediately
    setLoading(true);

    // Debounce 400ms
    debounceRef.current = setTimeout(() => {
      search(trimmed);
    }, 400);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { query, setQuery, results, loading, error };
}
