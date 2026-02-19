'use client';

import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

import { useDailyContent, type DailyContentData } from '@/hooks/useDailyContent';
import { useDailyTranslation } from '@/context/DailyTranslationContext';
import { DailyPostSlide } from './DailyPostSlide';
import { AudioPlayerSlide } from './AudioPlayerSlide';
import { LumaShortSlide } from './LumaShortSlide';

interface DailyPostCarouselProps {
  /** Single-day mode: fetch by date (existing behavior) */
  date?: string;
  /** Feed mode: use prefetched content instead of fetching */
  prefetchedContent?: DailyContentData;
  /** Whether this card is the currently visible one (media isolation) */
  isActive?: boolean;
  /** Whether we're in vertical feed mode (controls date label vs DateNavigator) */
  feedMode?: boolean;
  /** Admin preview mode: always show full dates, skip Today/Yesterday */
  previewMode?: boolean;
}

export function DailyPostCarousel({
  date,
  prefetchedContent,
  isActive = true,
  feedMode = false,
  previewMode = false,
}: DailyPostCarouselProps) {
  // --- Feed mode: use prefetched data ---
  if (prefetchedContent) {
    return (
      <FeedModeCarousel
        content={prefetchedContent}
        isActive={isActive}
        feedMode={feedMode}
        previewMode={previewMode}
      />
    );
  }

  // --- Single-day mode: fetch data via hook ---
  return <SingleDayCarousel date={date} />;
}

/** Single-day carousel (e.g. /daily/[date]) — also uses global context */
function SingleDayCarousel({ date }: { date?: string }) {
  const {
    content,
    loading,
    error,
    resolvedAudioUrl,
    resolvedSrtUrl,
  } = useDailyContent(date);

  const dailyTranslation = useDailyTranslation();

  // Register translations into global context when content loads
  useEffect(() => {
    if (!content || !dailyTranslation) return;
    const codes = content.translations.map((t) => t.code);
    dailyTranslation.registerTranslations(codes, content.translation_names);
  }, [content, dailyTranslation]);

  const activeTranslation = dailyTranslation?.activeTranslation ?? null;

  if (loading) {
    return (
      <div className="flex w-full items-center justify-center bg-[#0a0a0f]" style={{ height: '100svh' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="flex w-full items-center justify-center bg-[#0a0a0f]" style={{ height: '100svh' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  const activeT = activeTranslation
    ? content.translations.find((t) => t.code === activeTranslation)
    : null;
  const resolvedChapterText = activeT?.chapter_text || null;

  return (
    <CarouselSwiper
      content={content}
      activeTranslation={activeTranslation}
      resolvedAudioUrl={resolvedAudioUrl}
      resolvedSrtUrl={resolvedSrtUrl}
      resolvedChapterText={resolvedChapterText}
      isActive={true}
      feedMode={false}
    />
  );
}

/** Feed-mode carousel: reads translation from global context */
function FeedModeCarousel({
  content,
  isActive,
  feedMode,
  previewMode = false,
}: {
  content: DailyContentData;
  isActive: boolean;
  feedMode: boolean;
  previewMode?: boolean;
}) {
  const dailyTranslation = useDailyTranslation();
  const activeTranslation = dailyTranslation?.activeTranslation ?? null;

  const [localContent, setLocalContent] = useState(content);
  const translationCacheRef = useRef(
    new Map<string, { text: string; audio_url: string | null; audio_srt_url: string | null; chapter_text: string | null }>(
      content.translations.map((t) => [t.code, { text: t.text, audio_url: t.audio_url, audio_srt_url: t.audio_srt_url, chapter_text: t.chapter_text }])
    )
  );

  // When global translation changes, fetch if not cached for this day
  useEffect(() => {
    if (!activeTranslation) return;
    const code = activeTranslation.toUpperCase();
    if (translationCacheRef.current.has(code)) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/translations?daily_content_id=${content.id}&translation_code=${code}`
        );
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const entry = {
          text: data.text,
          audio_url: data.audio_url ?? null,
          audio_srt_url: data.audio_srt_url ?? null,
          chapter_text: data.chapter_text ?? null,
        };
        translationCacheRef.current.set(code, entry);
        setLocalContent((prev) => {
          if (prev.translations.some((t) => t.code === code)) return prev;
          return { ...prev, translations: [...prev.translations, { code, ...entry }] };
        });
      } catch {
        // Silently fail — show base content
      }
    })();
    return () => { cancelled = true; };
  }, [activeTranslation, content.id]);

  // Resolve audio/SRT from active translation
  const activeT = activeTranslation
    ? localContent.translations.find((t) => t.code === activeTranslation)
    : null;
  const resolvedAudioUrl = activeT?.audio_url || null;
  const resolvedSrtUrl = activeT?.audio_srt_url || null;
  const resolvedChapterText = activeT?.chapter_text || null;

  return (
    <CarouselSwiper
      content={localContent}
      activeTranslation={activeTranslation}
      resolvedAudioUrl={resolvedAudioUrl}
      resolvedSrtUrl={resolvedSrtUrl}
      resolvedChapterText={resolvedChapterText}
      isActive={isActive}
      feedMode={feedMode}
      previewMode={previewMode}
    />
  );
}

/** Shared Swiper carousel rendering */
function CarouselSwiper({
  content,
  activeTranslation,
  resolvedAudioUrl,
  resolvedSrtUrl,
  resolvedChapterText,
  isActive,
  feedMode,
  previewMode = false,
}: {
  content: DailyContentData;
  activeTranslation: string | null;
  resolvedAudioUrl: string | null;
  resolvedSrtUrl: string | null;
  resolvedChapterText: string | null;
  isActive: boolean;
  feedMode: boolean;
  previewMode?: boolean;
}) {
  const [activeSlide, setActiveSlide] = useState(0);

  // Stabilize content reference for DailyPostSlide — only changes when video URL
  // or core content fields change, NOT when translations are added
  const slideContent = useMemo(() => content, [
    content.id,
    content.video_background_url,
    content.content_text,
    content.verse_reference,
    content.post_date,
    content.mode,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    content.translations.length,
  ]);

  return (
    <Swiper
      modules={[Pagination, Keyboard]}
      slidesPerView={1}
      pagination={{
        clickable: true,
        bulletClass: 'swiper-pagination-bullet !bg-white/50 !opacity-100',
        bulletActiveClass: '!bg-white !opacity-100 !scale-125',
      }}
      keyboard={{ enabled: true }}
      onSlideChange={(swiper) => setActiveSlide(swiper.activeIndex)}
      className="h-full w-full"
      style={
        {
          '--swiper-pagination-bottom': 'calc(4rem + env(safe-area-inset-bottom, 0px) + 8px)',
        } as React.CSSProperties
      }
    >
      {/* Slide 1: Video background with verse/quote overlay */}
      <SwiperSlide>
        <DailyPostSlide
          content={slideContent}
          activeTranslation={activeTranslation}
          isActive={isActive && activeSlide === 0}
          feedMode={feedMode}
          previewMode={previewMode}
        />
      </SwiperSlide>

      {/* Slide 2: Audio player with SRT subtitle sync */}
      <SwiperSlide>
        <AudioPlayerSlide
          content={content}
          activeTranslation={activeTranslation}
          resolvedAudioUrl={resolvedAudioUrl}
          resolvedSrtUrl={resolvedSrtUrl}
          resolvedChapterText={resolvedChapterText}
          isActive={isActive && activeSlide === 1}
        />
      </SwiperSlide>

      {/* Slide 3: LumaShort video */}
      <SwiperSlide>
        <LumaShortSlide content={content} isActive={isActive && activeSlide === 2} />
      </SwiperSlide>
    </Swiper>
  );
}
