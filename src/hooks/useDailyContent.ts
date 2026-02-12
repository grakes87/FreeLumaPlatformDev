'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface DailyContentData {
  id: number;
  post_date: string;
  mode: 'bible' | 'positivity';
  title: string;
  content_text: string;
  verse_reference: string | null;
  chapter_reference: string | null;
  video_background_url: string;
  audio_url: string | null;
  audio_srt_url: string | null;
  lumashort_video_url: string | null;
  translations: Array<{ code: string; text: string }>;
}

interface UseDailyContentReturn {
  content: DailyContentData | null;
  loading: boolean;
  error: string | null;
  activeTranslation: string | null;
  availableTranslations: string[];
  switchTranslation: (translationCode: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Client-side hook for fetching and managing daily content.
 *
 * @param date - Optional date (YYYY-MM-DD). If omitted, fetches today's content.
 * @returns Daily content data, loading state, error state, and translation switching.
 */
export function useDailyContent(date?: string): UseDailyContentReturn {
  const [content, setContent] = useState<DailyContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTranslation, setActiveTranslation] = useState<string | null>(null);

  // Cache fetched translations to avoid re-fetching
  const translationCache = useRef<Map<string, string>>(new Map());

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = date
        ? `/api/daily-posts/${date}`
        : '/api/daily-posts';

      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch daily content (${response.status})`);
      }

      const data: DailyContentData = await response.json();
      setContent(data);

      // Populate translation cache from included translations
      translationCache.current.clear();
      for (const t of data.translations) {
        translationCache.current.set(t.code, t.text);
      }

      // Set active translation to the first available, or null
      if (data.translations.length > 0) {
        setActiveTranslation(data.translations[0].code);
      } else {
        setActiveTranslation(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch daily content';
      setError(message);
      setContent(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const switchTranslation = useCallback(async (translationCode: string) => {
    if (!content) return;

    const code = translationCode.toUpperCase();

    // Check cache first
    const cached = translationCache.current.get(code);
    if (cached) {
      setActiveTranslation(code);
      return;
    }

    // Fetch from API
    try {
      const response = await fetch(
        `/api/translations?daily_content_id=${content.id}&translation_code=${code}`
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Translation "${code}" is not available`);
      }

      const data = await response.json();

      // Cache the fetched translation
      translationCache.current.set(code, data.text);

      // Update content translations list
      setContent((prev) => {
        if (!prev) return prev;
        const exists = prev.translations.some((t) => t.code === code);
        if (exists) return prev;
        return {
          ...prev,
          translations: [...prev.translations, { code, text: data.text }],
        };
      });

      setActiveTranslation(code);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch translation';
      console.error('[useDailyContent] Translation switch error:', message);
      // Don't update error state for translation failures -- keep showing current content
      throw err;
    }
  }, [content]);

  const availableTranslations = content?.translations.map((t) => t.code) ?? [];

  return {
    content,
    loading,
    error,
    activeTranslation,
    availableTranslations,
    switchTranslation,
    refetch: fetchContent,
  };
}
