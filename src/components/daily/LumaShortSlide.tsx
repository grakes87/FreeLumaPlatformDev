'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Film } from 'lucide-react';
import type { DailyContentData } from '@/hooks/useDailyContent';

interface LumaShortSlideProps {
  content: DailyContentData;
  isActive?: boolean;
}

export function LumaShortSlide({ content, isActive = true }: LumaShortSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // Lazy load: only mount video element once the slide has been active
  const [hasBeenActive, setHasBeenActive] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Track first activation — once active, keep the video in DOM
  useEffect(() => {
    if (isActive && !hasBeenActive) {
      setHasBeenActive(true);
    }
  }, [isActive, hasBeenActive]);

  // Pause video when card scrolls out of view
  useEffect(() => {
    if (isActive === false && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [isActive]);

  const handleCanPlay = useCallback(() => {
    setVideoReady(true);
  }, []);

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
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Fullscreen video — only mounted after slide becomes active */}
      {hasBeenActive && (
        <video
          ref={videoRef}
          playsInline
          preload="metadata"
          onCanPlay={handleCanPlay}
          className={
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ' +
            (videoReady ? 'opacity-100' : 'opacity-0')
          }
        >
          <source src={`${content.lumashort_video_url}#t=0.001`} type="video/mp4" />
        </video>
      )}

      {/* Loading spinner while video loads */}
      {hasBeenActive && !videoReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {/* Gradient overlays for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      {/* Top: Title */}
      <div className="absolute left-0 right-0 z-10 px-6 text-center" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px) + 0.5rem)' }}>
        <p className="text-xs font-medium uppercase tracking-widest text-white/60">LumaShort</p>
        <h2 className="mt-1 text-lg font-semibold text-white drop-shadow-lg">
          {(() => {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const yest = new Date(now);
            yest.setDate(yest.getDate() - 1);
            const yesterdayStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
            if (content.post_date === todayStr) return 'Today';
            if (content.post_date === yesterdayStr) return 'Yesterday';
            return new Date(content.post_date + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            });
          })()}
        </h2>
      </div>

      {/* Play/Pause tap area */}
      <button
        type="button"
        onClick={handlePlay}
        className="absolute inset-0 z-10"
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
      />

      {/* Play button overlay (before first play) */}
      {!hasStarted && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 shadow-xl">
            <Play className="h-9 w-9 translate-x-0.5 text-gray-900" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Pause indicator (briefly shown on tap) */}
      {hasStarted && !isPlaying && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            <Play className="h-7 w-7 translate-x-0.5 text-white" fill="currentColor" />
          </div>
        </div>
      )}
    </div>
  );
}
