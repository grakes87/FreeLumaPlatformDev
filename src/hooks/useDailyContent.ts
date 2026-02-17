'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { detectTimezone } from '@/lib/utils/timezone';
import { LANGUAGES } from '@/lib/utils/constants';

export interface DailyContentData {
  id: number;
  post_date: string;
  mode: 'bible' | 'positivity';
  language: 'en' | 'es';
  title: string;
  content_text: string;
  verse_reference: string | null;
  chapter_reference: string | null;
  video_background_url: string;
  lumashort_video_url: string | null;
  translations: Array<{ code: string; text: string; audio_url: string | null; audio_srt_url: string | null; chapter_text: string | null }>;
  translation_names: Record<string, string>;
}

interface UseDailyContentReturn {
  content: DailyContentData | null;
  loading: boolean;
  error: string | null;
  activeLanguage: string;
  activeTranslation: string | null;
  availableTranslations: string[];
  translationNames: Record<string, string>;
  resolvedAudioUrl: string | null;
  resolvedSrtUrl: string | null;
  switchLanguage: (lang: string) => void;
  switchTranslation: (translationCode: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Client-side hook for fetching and managing daily content.
 *
 * @param date - Optional date (YYYY-MM-DD). If omitted, fetches today's content.
 * @returns Daily content data, loading state, error state, and translation switching.
 */
function getLanguageCookie(): string {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/(?:^|; )preferred_language=([a-z]{2})/);
  const val = match?.[1] ?? 'en';
  return (LANGUAGES as readonly string[]).includes(val) ? val : 'en';
}

function setLanguageCookie(lang: string) {
  document.cookie = `preferred_language=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function useDailyContent(date?: string): UseDailyContentReturn {
  const [content, setContent] = useState<DailyContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState(getLanguageCookie);
  const [activeTranslation, setActiveTranslation] = useState<string | null>(null);

  // Cache fetched translations to avoid re-fetching
  const translationCache = useRef<Map<string, { text: string; audio_url: string | null; audio_srt_url: string | null; chapter_text: string | null }>>(new Map());
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const tz = encodeURIComponent(detectTimezone());
      const url = date
        ? `/api/daily-posts/${date}?timezone=${tz}`
        : `/api/daily-posts?timezone=${tz}`;

      const response = await fetch(url, { credentials: 'include' });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch daily content (${response.status})`);
      }

      const data: DailyContentData = await response.json();

      // Preload video before showing content to avoid gradient flash
      const videoUrl = data.video_background_url;
      const hasVideo = videoUrl && videoUrl !== '' && !videoUrl.includes('placeholder');
      if (hasVideo) {
        await new Promise<void>((resolve) => {
          const video = document.createElement('video');
          video.preload = 'auto';
          video.muted = true;
          const done = () => { video.remove(); resolve(); };
          video.addEventListener('canplay', done, { once: true });
          video.addEventListener('error', done, { once: true });
          // Timeout fallback — don't block forever
          const timer = setTimeout(done, 5000);
          video.addEventListener('canplay', () => clearTimeout(timer), { once: true });
          video.addEventListener('error', () => clearTimeout(timer), { once: true });
          video.src = videoUrl;
          video.load();
        });
      }

      setContent(data);
      retryCountRef.current = 0;

      // Populate translation cache from included translations
      translationCache.current.clear();
      for (const t of data.translations) {
        translationCache.current.set(t.code, {
          text: t.text,
          audio_url: t.audio_url ?? null,
          audio_srt_url: t.audio_srt_url ?? null,
          chapter_text: t.chapter_text ?? null,
        });
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
      // Auto-retry on failure (e.g. auth not ready on mobile reload)
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        const delay = retryCountRef.current * 1500;
        retryTimerRef.current = setTimeout(() => fetchContent(), delay);
      }
    } finally {
      setLoading(false);
    }
  }, [date]);

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
      const entry = {
        text: data.text,
        audio_url: data.audio_url ?? null,
        audio_srt_url: data.audio_srt_url ?? null,
        chapter_text: data.chapter_text ?? null,
      };
      translationCache.current.set(code, entry);

      // Update content translations list
      setContent((prev) => {
        if (!prev) return prev;
        const exists = prev.translations.some((t) => t.code === code);
        if (exists) return prev;
        return {
          ...prev,
          translations: [...prev.translations, { code, ...entry }],
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

  const switchLanguage = useCallback((lang: string) => {
    if (!(LANGUAGES as readonly string[]).includes(lang)) return;
    if (lang === activeLanguage) return;

    setActiveLanguage(lang);
    setLanguageCookie(lang);

    // If authenticated, persist to DB (fire-and-forget)
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ language: lang }),
    }).catch(() => {});
  }, [activeLanguage]);

  // Refetch when language changes; clean up retry timers on unmount
  useEffect(() => {
    fetchContent();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [activeLanguage, fetchContent]);

  const availableTranslations = content?.translations.map((t) => t.code) ?? [];
  const translationNames = content?.translation_names ?? {};

  // Resolve audio/SRT: prefer active translation's URLs, fall back to base content
  const activeT = activeTranslation
    ? content?.translations.find((t) => t.code === activeTranslation)
    : null;
  const resolvedAudioUrl = activeT?.audio_url || null;
  const resolvedSrtUrl = activeT?.audio_srt_url || null;

  return {
    content,
    loading,
    error,
    activeLanguage,
    activeTranslation,
    availableTranslations,
    translationNames,
    resolvedAudioUrl,
    resolvedSrtUrl,
    switchLanguage,
    switchTranslation,
    refetch: fetchContent,
  };
}
