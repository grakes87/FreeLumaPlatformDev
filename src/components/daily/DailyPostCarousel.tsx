'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

import { useDailyContent } from '@/hooks/useDailyContent';
import { DailyPostSlide } from './DailyPostSlide';
import { AudioPlayerSlide } from './AudioPlayerSlide';
import { LumaShortSlide } from './LumaShortSlide';

interface DailyPostCarouselProps {
  date?: string;
}

export function DailyPostCarousel({ date }: DailyPostCarouselProps) {
  const {
    content,
    loading,
    error,
    activeTranslation,
    availableTranslations,
    switchTranslation,
  } = useDailyContent(date);

  // Loading state: full-screen skeleton with pulsing gradient
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="animate-pulse text-sm text-white/60">Loading daily content...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !content) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460] px-6 text-center">
        <div className="mb-4 text-4xl">&#x2728;</div>
        <h2 className="text-lg font-semibold text-white">No content for today</h2>
        <p className="mt-2 max-w-sm text-sm text-white/60">
          {error || 'Daily content is not available yet. Check back later.'}
        </p>
      </div>
    );
  }

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
      className="h-screen w-full"
      style={
        {
          '--swiper-pagination-bottom': '72px',
        } as React.CSSProperties
      }
    >
      {/* Slide 1: Video background with verse/quote overlay */}
      <SwiperSlide>
        <DailyPostSlide
          content={content}
          activeTranslation={activeTranslation}
          availableTranslations={availableTranslations}
          onSwitchTranslation={switchTranslation}
        />
      </SwiperSlide>

      {/* Slide 2: Audio player with SRT subtitle sync */}
      <SwiperSlide>
        <AudioPlayerSlide content={content} />
      </SwiperSlide>

      {/* Slide 3: LumaShort video */}
      <SwiperSlide>
        <LumaShortSlide content={content} />
      </SwiperSlide>
    </Swiper>
  );
}
