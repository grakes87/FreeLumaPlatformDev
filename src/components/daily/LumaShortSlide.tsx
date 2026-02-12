'use client';

import type { DailyContentData } from '@/hooks/useDailyContent';

interface LumaShortSlideProps {
  content: DailyContentData;
}

/**
 * Slide 3: LumaShort video with user-initiated playback.
 * Full implementation in Task 2.
 */
export function LumaShortSlide({ content }: LumaShortSlideProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#1A1A2E] to-[#0F0F23] px-6 text-center">
      <p className="text-lg font-medium text-white/80">LumaShort</p>
      <p className="mt-2 text-sm text-white/40">
        {content.lumashort_video_url ? 'Video available' : 'LumaShort not available for this day'}
      </p>
    </div>
  );
}
