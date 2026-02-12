'use client';

import { useState, useRef, useCallback } from 'react';
import { Play, Film } from 'lucide-react';
import type { DailyContentData } from '@/hooks/useDailyContent';

interface LumaShortSlideProps {
  content: DailyContentData;
}

export function LumaShortSlide({ content }: LumaShortSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // No LumaShort video available
  if (!content.lumashort_video_url) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#1A1A2E] to-[#0F0F23] px-6 text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <Film className="h-7 w-7 text-white/40" />
        </div>
        <h2 className="text-lg font-semibold text-white/80">LumaShort Not Available</h2>
        <p className="mt-2 max-w-sm text-sm text-white/40">
          A LumaShort video is not available for this day.
        </p>
      </div>
    );
  }

  const handlePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!hasStarted) {
      setHasStarted(true);
      video.play().catch(console.error);
    } else if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(console.error);
    }
  }, [hasStarted, isPlaying]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#1A1A2E] to-[#0F0F23]">
      {/* Title */}
      <div className="absolute top-20 z-10 px-6 text-center">
        <h2 className="text-lg font-semibold text-white">LumaShort</h2>
        <p className="mt-1 text-sm text-white/50">
          {content.chapter_reference || content.title}
        </p>
      </div>

      {/* Video container */}
      <div className="relative w-full max-w-lg px-6">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black/30 shadow-2xl">
          <video
            ref={videoRef}
            playsInline
            controls={hasStarted}
            preload="metadata"
            className="h-full w-full object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setHasStarted(false);
            }}
          >
            <source src={content.lumashort_video_url} type="video/mp4" />
          </video>

          {/* Play button overlay (shown before user initiates playback) */}
          {!hasStarted && (
            <button
              type="button"
              onClick={handlePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
              aria-label="Play LumaShort video"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 shadow-xl transition-transform hover:scale-110 active:scale-95">
                <Play className="h-9 w-9 translate-x-0.5 text-gray-900" fill="currentColor" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
