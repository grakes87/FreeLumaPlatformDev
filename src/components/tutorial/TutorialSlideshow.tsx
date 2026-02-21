'use client';

import { useRef } from 'react';
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
    return (
      <div className="mx-auto flex h-28 w-20 flex-col items-center justify-center rounded-xl border-2 border-purple-200 bg-purple-50 p-2 dark:border-purple-800 dark:bg-purple-900/20">
        <div className="mb-1 h-2.5 w-12 rounded-sm bg-purple-400/40" />
        <div className="mb-1 h-2 w-10 rounded-sm bg-purple-200/60 dark:bg-purple-700/40" />
        <div className="mb-1 h-2 w-8 rounded-sm bg-purple-200/40 dark:bg-purple-700/30" />
        <div className="mt-auto flex flex-col items-center">
          <div className="animate-bounce text-xs text-purple-400">^</div>
          <span className="text-[9px] text-purple-400/70">swipe</span>
        </div>
      </div>
    );
  }

  if (stepId === 'modes') {
    return (
      <div className="mx-auto flex gap-3">
        <div className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/10 p-2">
          <BookOpen className="mb-1 h-5 w-5 text-purple-500" />
          <span className="text-[10px] text-purple-500">Bible</span>
        </div>
        <div className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 p-2">
          <Sun className="mb-1 h-5 w-5 text-amber-500" />
          <span className="text-[10px] text-amber-500">Positivity</span>
        </div>
      </div>
    );
  }

  if (stepId === 'social') {
    return (
      <div className="mx-auto flex items-center gap-4">
        {['heart', 'comment', 'share'].map((item) => (
          <div
            key={item}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/20"
          >
            {item === 'heart' && <Heart className="h-5 w-5 text-red-400" />}
            {item === 'comment' && <span className="text-lg">💬</span>}
            {item === 'share' && <span className="text-lg">🔗</span>}
          </div>
        ))}
      </div>
    );
  }

  if (stepId === 'navigation') {
    return (
      <div className="mx-auto flex w-52 items-center justify-around rounded-xl border border-purple-200 bg-purple-50 px-2 py-2.5 dark:border-purple-800 dark:bg-purple-900/20">
        {['Daily', 'Prayer', 'Feed', '+', 'Watch', 'Profile'].map((tab) => (
          <div key={tab} className="flex flex-col items-center gap-0.5">
            <div className={cn('h-3 w-3 rounded-sm', tab === '+' ? 'rounded-full bg-purple-500' : 'bg-purple-300/50 dark:bg-purple-600/50')} />
            <span className="text-[7px] text-purple-400/70">{tab}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

const SWIPE_THRESHOLD = 50;

export function TutorialSlideshow() {
  const { currentStep, advance, skip, userMode } = useTutorial();
  const touchStartX = useRef(0);

  const step = slideshowSteps[currentStep];
  if (!step) return null;

  const Icon = iconMap[step.icon] || Sparkles;
  let description = step.description;
  if (userMode === 'bible' && step.bibleDescription) {
    description = step.bibleDescription;
  } else if (userMode === 'positivity' && step.positivityDescription) {
    description = step.positivityDescription;
  }

  const isLast = currentStep >= slideshowSteps.length - 1;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > SWIPE_THRESHOLD) {
      // Swiped left → next slide
      advance();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-4">
        {/* Card — single slide shown at a time */}
        <div
          className={cn(
            'mx-auto flex w-full flex-col items-center rounded-2xl p-6',
            'bg-white dark:bg-gray-900',
            'shadow-2xl'
          )}
        >
          {/* Icon */}
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
            <Icon className="h-7 w-7 text-purple-600 dark:text-purple-300" />
          </div>

          {/* Title */}
          <h2 className="mb-2 text-center text-xl font-bold text-gray-900 dark:text-white">
            {step.title}
          </h2>

          {/* Description */}
          <p className="mb-5 text-center text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {description}
          </p>

          {/* Illustration — fixed height container */}
          <div className="flex h-24 items-center justify-center">
            <SlideIllustration stepId={step.id} />
          </div>

          {/* Next / Get Started button */}
          <button
            type="button"
            onClick={advance}
            className={cn(
              'mt-5 w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition-colors',
              'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
            )}
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>

        {/* Pagination dots */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {slideshowSteps.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                idx === currentStep
                  ? 'w-6 bg-white'
                  : 'w-2 bg-white/40'
              )}
            />
          ))}
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
