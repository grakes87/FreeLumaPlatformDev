'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { DailyPostCarousel } from '@/components/daily/DailyPostCarousel';
import { DailyTranslationProvider } from '@/context/DailyTranslationContext';
import type { DailyContentData } from '@/hooks/useDailyContent';

/**
 * Standalone preview feed page rendered inside an iframe (375x812).
 * Uses the admin preview-feed API — requires admin auth cookie.
 *
 * Query params: month, mode, language
 */
export default function PreviewFeedPage() {
  const searchParams = useSearchParams();
  const month = searchParams.get('month') || '';
  const mode = searchParams.get('mode') || 'bible';
  const language = searchParams.get('language') || 'en';

  const [days, setDays] = useState<DailyContentData[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const params = new URLSearchParams({ month, mode, language });
        const res = await fetch(`/api/admin/content-production/preview-feed?${params}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            setDays(json.days ?? []);
            setActiveIndex(0);
          }
        }
      } catch {
        // Silently fail inside iframe
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [month, mode, language]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const cardHeight = container.clientHeight;
    if (cardHeight === 0) return;
    const index = Math.round(container.scrollTop / cardHeight);
    setActiveIndex(index);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
        <p className="text-sm text-white/60">No content to preview.</p>
      </div>
    );
  }

  return (
    <DailyTranslationProvider>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-screen overflow-y-auto bg-[#0a0a0f]"
        style={{ scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain' }}
      >
        {days.map((day, index) => (
          <div
            key={day.id}
            className="w-full snap-start snap-always"
            style={{ height: '100svh' }}
          >
            {Math.abs(index - activeIndex) <= 1 ? (
              <DailyPostCarousel
                prefetchedContent={day}
                isActive={index === activeIndex}
                feedMode
                previewMode
              />
            ) : (
              <div className="h-full w-full bg-[#0a0a0f]" />
            )}
          </div>
        ))}
      </div>
    </DailyTranslationProvider>
  );
}
