'use client';

import type { DailyContentData } from '@/hooks/useDailyContent';

interface AudioPlayerSlideProps {
  content: DailyContentData;
}

/**
 * Slide 2: Audio player with SRT subtitle sync.
 * Full implementation in Task 2.
 */
export function AudioPlayerSlide({ content }: AudioPlayerSlideProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#1A1A2E] to-[#0F0F23] px-6 text-center">
      <p className="text-lg font-medium text-white/80">Audio Player</p>
      <p className="mt-2 text-sm text-white/40">
        {content.audio_url ? 'Audio available' : 'Audio not available for this day'}
      </p>
    </div>
  );
}
