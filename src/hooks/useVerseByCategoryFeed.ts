'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { ReactionType } from '@/lib/utils/constants';

// --- Types matching API response shapes ---

export interface VerseCategoryData {
  id: number | 'all';
  name: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  verse_count: number;
}

export interface VerseTranslation {
  id: number;
  verse_category_content_id: number;
  translation_code: string;
  translated_text: string;
  source: string;
}

export interface VerseData {
  id: number;
  category_id: number;
  verse_reference: string;
  content_text: string;
  book: string;
  category: { id: number; name: string; slug: string };
  translations: VerseTranslation[];
}

export interface VerseByCategoryState {
  verse: VerseData | null;
  backgroundUrl: string | null;
  userReaction: ReactionType | null;
  reactionCounts: Record<string, number>;
  reactionTotal: number;
  commentCount: number;
  categories: VerseCategoryData[];
  activeCategoryId: number | 'all';
  loading: boolean;
  error: string | null;
}

// --- localStorage tracking to avoid recent repeats ---

const STORAGE_KEY = 'verse_category_recent';
const MAX_RECENT = 10;

function getRecentVerseIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((n: unknown) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

function addRecentVerseId(id: number): void {
  if (typeof window === 'undefined') return;
  try {
    const recent = getRecentVerseIds().filter((v) => v !== id);
    recent.unshift(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // localStorage full or unavailable
  }
}

// --- Hook ---

export function useVerseByCategoryFeed() {
  const { user } = useAuth();

  const [verse, setVerse] = useState<VerseData | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [reactionTotal, setReactionTotal] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [categories, setCategories] = useState<VerseCategoryData[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);
  const prefetchedBgRef = useRef<string | null>(null);

  // Fetch categories list
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/verse-categories', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      // API wraps in { data: [...] }
      const cats = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      setCategories(cats);
    } catch (err) {
      console.error('[useVerseByCategoryFeed] categories error:', err);
    }
  }, []);

  // Fetch a random verse
  const fetchVerse = useCallback(async (categoryId: number | 'all' = 'all') => {
    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const recentIds = getRecentVerseIds();
      const params = new URLSearchParams();
      if (categoryId !== 'all') {
        params.set('category_id', String(categoryId));
      } else {
        params.set('category_id', 'all');
      }
      if (recentIds.length > 0) {
        params.set('exclude', recentIds.join(','));
      }

      const res = await fetch(`/api/verse-by-category?${params}`, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch verse (${res.status})`);
      }

      const data = await res.json();
      // API wraps in { data: { verse, background_url, ... } }
      const payload = data.data ?? data;

      setVerse(payload.verse);
      setBackgroundUrl(payload.background_url);
      setUserReaction(payload.user_reaction ?? null);
      setReactionCounts(payload.reaction_counts ?? {});
      setReactionTotal(payload.reaction_total ?? 0);
      setCommentCount(payload.comment_count ?? 0);

      if (payload.verse?.id) {
        addRecentVerseId(payload.verse.id);
      }

      // Prefetch next background image so the next swipe is instant
      const prefetchParams = new URLSearchParams();
      prefetchParams.set('category_id', String(categoryId));
      prefetchParams.set('exclude', getRecentVerseIds().join(','));
      prefetchParams.set('bg_only', '1');
      fetch(`/api/verse-by-category/prefetch-bg?${prefetchParams}`, { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          const url = d?.data?.background_url ?? d?.background_url;
          if (url) {
            prefetchedBgRef.current = url;
            const img = new Image();
            img.src = url;
          }
        })
        .catch(() => {});
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to fetch verse';
      setError(message);
      console.error('[useVerseByCategoryFeed] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Select a category and fetch a new verse
  const selectCategory = useCallback(
    (id: number | 'all') => {
      setActiveCategoryId(id);
      fetchVerse(id);

      if (user) {
        // Fire-and-forget persist category preference
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ verse_category_id: id === 'all' ? null : id }),
        }).catch(() => {});
      } else {
        // Guest: persist to localStorage
        try { localStorage.setItem('verse_category_id', String(id)); } catch {}
      }
    },
    [fetchVerse, user]
  );

  // Get translated text for a given translation code, fallback to KJV (content_text)
  const getTranslatedText = useCallback(
    (translationCode: string): string => {
      if (!verse) return '';
      const translation = verse.translations.find(
        (t) => t.translation_code.toUpperCase() === translationCode.toUpperCase()
      );
      return translation?.translated_text ?? verse.content_text;
    },
    [verse]
  );

  // Initial load
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      await fetchCategories();
      // Use user's saved category, or guest localStorage, or default to 'all'
      let initialCategory: number | 'all' = 'all';
      const savedCategoryId = (user as Record<string, unknown> | null)?.verse_category_id;
      if (typeof savedCategoryId === 'number') {
        initialCategory = savedCategoryId;
      } else if (!user) {
        try {
          const stored = localStorage.getItem('verse_category_id');
          if (stored && stored !== 'all') {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed)) initialCategory = parsed;
          }
        } catch {}
      }
      setActiveCategoryId(initialCategory);
      await fetchVerse(initialCategory);
    };

    init();

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchCategories, fetchVerse, user]);

  return {
    verse,
    backgroundUrl,
    userReaction,
    reactionCounts,
    reactionTotal,
    commentCount,
    categories,
    activeCategoryId,
    loading,
    error,
    selectCategory,
    getTranslatedText,
    fetchVerse,
  };
}
