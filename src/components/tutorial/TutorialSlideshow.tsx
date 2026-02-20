'use client';

import { useRef, useCallback } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/pagination';
import {
  Sparkles,
  BookOpen,
  Sun,
  Heart,
  Navigation2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { slideshowSteps } from './tutorialSteps';
import { useTutorial } from './TutorialProvider';

const iconMap: Record<string, LucideIcon> = {
  Sparkles,
  BookOpen,
  Sun,
  Heart,
  Navigation2,
};

/** CSS-only illustration for each slide */
function SlideIllustration({ stepId }: { stepId: string }) {
  if (stepId === 'daily-feed') {
    // Mini phone frame with swipe-up hint
    return (
      <div className="mx-auto mt-4 flex h-36 w-24 flex-col items-center justify-center rounded-xl border-2 border-white/20 bg-white/5 p-2">
        <div className="mb-1 h-3 w-14 rounded-sm bg-purple-400/40" />
        <div className="mb-1 h-2 w-12 rounded-sm bg-white/20" />
        <div className="mb-1 h-2 w-10 rounded-sm bg-white/15" />
        <div className="mt-auto flex flex-col items-center">
          <div className="animate-bounce text-xs text-white/50">^</div>
          <span className="text-[10px] text-white/40">swipe</span>
        </div>
      </div>
    );
  }

  if (stepId === 'modes') {
    // Two mode cards side by side
    return (
      <div className="mx-auto mt-4 flex gap-3">
        <div className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/10 p-2">
          <BookOpen className="mb-1 h-5 w-5 text-purple-300" />
          <span className="text-[10px] text-purple-300">Bible</span>
        </div>
        <div className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 p-2">
          <Sun className="mb-1 h-5 w-5 text-amber-300" />
          <span className="text-[10px] text-amber-300">Positivity</span>
        </div>
      </div>
    );
  }

  if (stepId === 'social') {
    // Reaction emoji row
    return (
      <div className="mx-auto mt-4 flex items-center gap-4">
        {['heart', 'comment', 'share'].map((item) => (
          <div
            key={item}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"
          >
            {item === 'heart' && <Heart className="h-5 w-5 text-red-400" />}
            {item === 'comment' && (
              <span className="text-lg">💬</span>
            )}
            {item === 'share' && (
              <span className="text-lg">🔗</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (stepId === 'navigation') {
    // Mini bottom nav bar
    return (
      <div className="mx-auto mt-4 flex w-56 items-center justify-around rounded-xl border border-white/20 bg-white/5 px-2 py-3">
        {['Home', 'Search', 'Create', 'Alerts', 'Profile'].map((tab) => (
          <div key={tab} className="flex flex-col items-center gap-0.5">
            <div className="h-3 w-3 rounded-sm bg-white/30" />
            <span className="text-[8px] text-white/40">{tab}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export function TutorialSlideshow() {
  const { currentStep, advance, skip, userMode, totalSteps } = useTutorial();
  const swiperRef = useRef<SwiperType | null>(null);

  const isLastSlide = currentStep >= slideshowSteps.length - 1;

  const handleNext = useCallback(() => {
    advance();
    // Swiper will sync via onSlideChange, but also push it programmatically
    if (swiperRef.current && !isLastSlide) {
      swiperRef.current.slideNext();
    }
  }, [advance, isLastSlide]);

  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      // If user swipes manually, keep currentStep in sync
      // We let TutorialProvider manage the state -- advance to match
      const idx = swiper.activeIndex;
      if (idx > currentStep) {
        advance();
      }
    },
    [currentStep, advance]
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-4">
        <Swiper
          modules={[Pagination, Keyboard]}
          slidesPerView={1}
          pagination={{
            clickable: true,
            bulletClass: 'swiper-pagination-bullet !bg-white/40 !opacity-100',
            bulletActiveClass: '!bg-white !opacity-100 !scale-125',
          }}
          keyboard={{ enabled: true }}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
          onSlideChange={handleSlideChange}
          allowTouchMove
          className="w-full"
        >
          {slideshowSteps.map((step) => {
            const Icon = iconMap[step.icon] || Sparkles;
            // Mode-specific description
            let description = step.description;
            if (userMode === 'bible' && step.bibleDescription) {
              description = step.bibleDescription;
            } else if (userMode === 'positivity' && step.positivityDescription) {
              description = step.positivityDescription;
            }

            return (
              <SwiperSlide key={step.id}>
                <div
                  className={cn(
                    'mx-auto flex min-h-[400px] flex-col items-center rounded-2xl p-6',
                    'bg-white dark:bg-gray-900',
                    'shadow-2xl'
                  )}
                >
                  {/* Icon */}
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
                    <Icon className="h-8 w-8 text-purple-600 dark:text-purple-300" />
                  </div>

                  {/* Title */}
                  <h2 className="mb-3 text-center text-xl font-bold text-gray-900 dark:text-white">
                    {step.title}
                  </h2>

                  {/* Description */}
                  <p className="mb-4 text-center text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {description}
                  </p>

                  {/* Illustration */}
                  <div className="flex flex-1 items-center">
                    <SlideIllustration stepId={step.id} />
                  </div>

                  {/* Next / Get Started button */}
                  <button
                    type="button"
                    onClick={handleNext}
                    className={cn(
                      'mt-4 w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition-colors',
                      'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
                    )}
                  >
                    {step.id === slideshowSteps[slideshowSteps.length - 1].id
                      ? 'Get Started'
                      : 'Next'}
                  </button>
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* Step indicator */}
        <div className="mt-4 text-center text-xs text-white/50">
          {currentStep + 1} of {totalSteps}
        </div>

        {/* Skip button */}
        <button
          type="button"
          onClick={skip}
          className="mt-3 pb-4 text-sm text-white/60 transition-colors hover:text-white/90"
        >
          Skip tutorial
        </button>
      </div>
    </div>
  );
}
