'use client';

import { useRef } from 'react';
import type { DailyContentData } from '@/hooks/useDailyContent';
import { useAutoFitText } from '@/hooks/useAutoFitText';
import { ShareButton } from './ShareButton';

interface DevotionalSlideProps {
  content: DailyContentData;
  isActive?: boolean;
}

export function DevotionalSlide({ content }: DevotionalSlideProps) {
  const reflectionText = content.devotional_reflection || '';

  // Auto-fit text to available space
  const devotionalTextRef = useRef<HTMLParagraphElement>(null);
  const devotionalCenterRef = useRef<HTMLDivElement>(null);
  useAutoFitText(devotionalTextRef, devotionalCenterRef, [reflectionText], 12);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #1a1a2e 100%)',
        }}
      />

      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
        }}
      />

      {/* Content overlay */}
      <div
        className="absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-between px-6"
        style={{
          height: '100svh',
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px) + 0.5rem)',
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 2.5rem)',
        }}
      >
        {/* Top spacer */}
        <div />

        {/* Center section: title + devotional reflection text */}
        <div
          ref={devotionalCenterRef}
          className="flex max-w-lg flex-col items-center text-center overflow-hidden"
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-white/60">
            Daily Devotional
          </p>
          {content.verse_reference && (
            <p className="mb-4 text-lg font-semibold text-white drop-shadow-lg sm:text-xl">
              {content.verse_reference}
            </p>
          )}
          <p
            ref={devotionalTextRef}
            className="font-sans text-lg leading-relaxed font-light text-white/90 sm:text-xl"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
          >
            {reflectionText}
          </p>
        </div>

        {/* Bottom section: share button only */}
        <div className="flex items-center justify-center">
          <ShareButton
            verseText={content.devotional_reflection!}
            reference={null}
            translationCode={null}
            mode={content.mode}
          />
        </div>
      </div>
    </div>
  );
}
