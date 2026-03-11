'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { DailyContentData } from '@/hooks/useDailyContent';
import { ShareButton } from './ShareButton';

interface DevotionalSlideProps {
  content: DailyContentData;
  isActive?: boolean;
}

export function DevotionalSlide({ content, isActive = true }: DevotionalSlideProps) {
  const bgVideoRef = useRef<HTMLVideoElement>(null);

  const hasVideo =
    content.video_background_url &&
    content.video_background_url !== '' &&
    !content.video_background_url.includes('placeholder');

  // Pause/resume background video based on isActive
  useEffect(() => {
    const video = bgVideoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive]);

  // Track video readiness — reset when video URL changes
  const [videoReady, setVideoReady] = useState(!hasVideo);
  const prevVideoUrl = useRef(content.video_background_url);

  useEffect(() => {
    if (content.video_background_url !== prevVideoUrl.current) {
      prevVideoUrl.current = content.video_background_url;
      if (hasVideo) {
        setVideoReady(false);
      } else {
        setVideoReady(true);
      }
    }
  }, [content.video_background_url, hasVideo]);

  const handleVideoCanPlay = useCallback(() => {
    setVideoReady(true);
  }, []);

  // Dynamic font sizing based on text length
  const reflectionText = content.devotional_reflection || '';
  const textLength = reflectionText.length;
  let textSizeClass = 'text-xl leading-relaxed sm:text-2xl';
  if (textLength >= 500) {
    textSizeClass = 'text-base leading-relaxed sm:text-lg';
  } else if (textLength >= 200) {
    textSizeClass = 'text-lg leading-relaxed sm:text-xl';
  }

  const isVeryLong = textLength >= 800;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Background layer -- dark base while video loads */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      {hasVideo && (
        <video
          ref={bgVideoRef}
          src={content.video_background_url}
          crossOrigin="anonymous"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          onCanPlay={handleVideoCanPlay}
          className={
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ' +
            (videoReady ? 'opacity-100' : 'opacity-0')
          }
        />
      )}

      {/* Loading spinner while video buffers */}
      {hasVideo && !videoReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/40" />

      {/* Content overlay -- fades in with the background video */}
      <div
        className={
          'absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-between px-6 transition-opacity duration-700 ' +
          (videoReady ? 'opacity-100' : 'opacity-0')
        }
        style={{
          height: '100svh',
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px) + 0.5rem)',
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 2.5rem)',
        }}
      >
        {/* Top section: label */}
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-white/60">
            Devotional Reflection
          </p>
        </div>

        {/* Center section: devotional reflection text */}
        <div
          className={
            'flex max-w-lg flex-col items-center text-center ' +
            (isVeryLong ? 'overflow-y-auto max-h-[60vh]' : '')
          }
        >
          <p
            className={
              'font-sans font-light text-white drop-shadow-lg ' + textSizeClass
            }
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
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
            videoRef={bgVideoRef}
          />
        </div>
      </div>
    </div>
  );
}
