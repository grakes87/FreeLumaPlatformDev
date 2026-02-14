'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react';
import type { DailyContentData } from '@/hooks/useDailyContent';
import { SubtitleDisplay } from './SubtitleDisplay';
import { useListenTracker } from '@/hooks/useListenTracker';
import { cn } from '@/lib/utils/cn';

interface AudioPlayerSlideProps {
  content: DailyContentData;
  activeTranslation: string | null;
  resolvedAudioUrl: string | null;
  resolvedSrtUrl: string | null;
  isActive?: boolean;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

/**
 * Format seconds to mm:ss display.
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayerSlide({
  content,
  activeTranslation,
  resolvedAudioUrl,
  resolvedSrtUrl,
  isActive = true,
}: AudioPlayerSlideProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  useListenTracker(content.id, isPlaying, currentTime, duration);

  // Pause audio when card scrolls out of view
  useEffect(() => {
    if (isActive === false && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [isActive]);

  const hasVideo = content.video_background_url &&
    content.video_background_url !== '' &&
    !content.video_background_url.includes('placeholder');

  // No audio available
  if (!resolvedAudioUrl) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 text-center">
        {/* Background */}
        {hasVideo ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
          >
            <source src={content.video_background_url} type="video/mp4" />
          </video>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

        <div className="relative z-10">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-xl mx-auto">
            <Play className="h-7 w-7 text-white/40" />
          </div>
          <h2 className="text-lg font-semibold text-white/80">Audio Not Available</h2>
          <p className="mt-2 max-w-sm text-sm text-white/40">
            Audio content is not available for this day.
          </p>
        </div>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  };

  const handleSkip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
  };

  const handleSpeedChange = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || duration <= 0) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  };

  const handleProgressDrag = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const audio = audioRef.current;
      const bar = progressRef.current;
      if (!audio || !bar || duration <= 0) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      audio.currentTime = ratio * duration;
    },
    [duration]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent | TouchEvent) => handleProgressDrag(e);
    const onUp = () => handleDragEnd();

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [isDragging, handleProgressDrag, handleDragEnd]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* Blurred video background (same source as slide 1) */}
      {hasVideo ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-50"
        >
          <source src={content.video_background_url} type="video/mp4" />
        </video>
      ) : null}

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={resolvedAudioUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      {/* Content layer */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Top: Frosted glass "album art" card */}
        <div className="flex-shrink-0 px-6 pb-3" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px) + 0.5rem)' }}>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-center backdrop-blur-xl">
            <p className="text-xs font-medium uppercase tracking-widest text-white/50">
              {content.mode === 'bible' ? 'Scripture Audio' : 'Daily Audio'}
            </p>
            <h2 className="mt-1.5 text-xl font-semibold text-white">
              {content.chapter_reference || content.title}
            </h2>
            {content.chapter_reference && content.title !== content.chapter_reference && (
              <p className="mt-1 text-sm text-white/50">{content.title}</p>
            )}
          </div>
        </div>

        {/* Center: Subtitle display (Apple Music lyrics style) */}
        <SubtitleDisplay
          srtUrl={resolvedSrtUrl}
          currentTime={currentTime}
          isPlaying={isPlaying}
        />

        {/* Bottom: Controls */}
        <div className="flex-shrink-0 px-6 pt-2" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 0.5rem)' }}>
          <div>
            {/* Progress bar — thin Apple Music style */}
            <div
              ref={progressRef}
              className="relative h-1 w-full cursor-pointer rounded-full bg-white/20"
              onClick={handleProgressClick}
              onMouseDown={() => setIsDragging(true)}
              onTouchStart={() => setIsDragging(true)}
              role="slider"
              aria-label="Audio progress"
              aria-valuenow={Math.round(currentTime)}
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              tabIndex={0}
            >
              {/* Progress fill */}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-white transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
              {/* Drag handle */}
              <div
                className={cn(
                  'absolute top-1/2 h-3 w-3 rounded-full bg-white shadow-md transition-transform',
                  isDragging ? 'scale-150' : 'scale-100'
                )}
                style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>

            {/* Time labels below the bar */}
            <div className="mt-1.5 flex justify-between">
              <span className="text-[11px] tabular-nums text-white/50">
                {formatTime(currentTime)}
              </span>
              <span className="text-[11px] tabular-nums text-white/50">
                {formatTime(duration)}
              </span>
            </div>

            {/* Playback controls */}
            <div className="mt-3 flex items-center justify-center">
              {/* Speed selector — left side */}
              <button
                type="button"
                onClick={handleSpeedChange}
                className="mr-auto rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={`Playback speed: ${playbackSpeed}x`}
              >
                {playbackSpeed}x
              </button>

              {/* Center controls group */}
              <div className="flex items-center gap-6">
                {/* Rewind 15s */}
                <button
                  type="button"
                  onClick={() => handleSkip(-15)}
                  className="relative text-white/70 transition-colors hover:text-white active:scale-90"
                  aria-label="Rewind 15 seconds"
                >
                  <RotateCcw className="h-7 w-7" />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
                    15
                  </span>
                </button>

                {/* Play/Pause — large centered button */}
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-gray-900 shadow-lg transition-transform active:scale-90"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" fill="currentColor" />
                  ) : (
                    <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
                  )}
                </button>

                {/* Forward 15s */}
                <button
                  type="button"
                  onClick={() => handleSkip(15)}
                  className="relative text-white/70 transition-colors hover:text-white active:scale-90"
                  aria-label="Forward 15 seconds"
                >
                  <RotateCw className="h-7 w-7" />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
                    15
                  </span>
                </button>
              </div>

              {/* Invisible spacer to balance speed button */}
              <div className="ml-auto w-[42px]" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
