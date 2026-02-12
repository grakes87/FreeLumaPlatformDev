'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react';
import type { DailyContentData } from '@/hooks/useDailyContent';
import { SubtitleDisplay } from './SubtitleDisplay';
import { cn } from '@/lib/utils/cn';

interface AudioPlayerSlideProps {
  content: DailyContentData;
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

export function AudioPlayerSlide({ content }: AudioPlayerSlideProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // No audio available
  if (!content.audio_url) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#1A1A2E] to-[#0F0F23] px-6 text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <Play className="h-7 w-7 text-white/40" />
        </div>
        <h2 className="text-lg font-semibold text-white/80">Audio Not Available</h2>
        <p className="mt-2 max-w-sm text-sm text-white/40">
          Audio content is not available for this day.
        </p>
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
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-[#1A1A2E] to-[#0F0F23]">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={content.audio_url}
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

      {/* Top: Title/chapter reference */}
      <div className="flex-shrink-0 px-6 pt-20 pb-2 text-center">
        <h2 className="text-lg font-semibold text-white">
          {content.chapter_reference || content.title}
        </h2>
        {content.chapter_reference && content.title !== content.chapter_reference && (
          <p className="mt-1 text-sm text-white/50">{content.title}</p>
        )}
      </div>

      {/* Center: Subtitle display */}
      <SubtitleDisplay
        srtUrl={content.audio_srt_url}
        currentTime={currentTime}
      />

      {/* Bottom: Audio controls (iPhone Music style) */}
      <div className="flex-shrink-0 px-6 pt-2 pb-24">
        {/* Progress bar */}
        <div className="mb-2 flex items-center gap-3">
          <span className="w-10 text-right text-xs tabular-nums text-white/50">
            {formatTime(currentTime)}
          </span>
          <div
            ref={progressRef}
            className="relative h-1 flex-1 cursor-pointer rounded-full bg-white/20"
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
                'absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-md transition-transform',
                isDragging ? 'scale-150' : 'scale-100'
              )}
              style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
            />
          </div>
          <span className="w-10 text-left text-xs tabular-nums text-white/50">
            {formatTime(duration)}
          </span>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-8">
          {/* Speed selector */}
          <button
            type="button"
            onClick={handleSpeedChange}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-white/60 transition-colors hover:text-white"
            aria-label={`Playback speed: ${playbackSpeed}x`}
          >
            {playbackSpeed}x
          </button>

          {/* Rewind 15s */}
          <button
            type="button"
            onClick={() => handleSkip(-15)}
            className="relative text-white/70 transition-colors hover:text-white"
            aria-label="Rewind 15 seconds"
          >
            <RotateCcw className="h-7 w-7" />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
              15
            </span>
          </button>

          {/* Play/Pause */}
          <button
            type="button"
            onClick={handlePlayPause}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-gray-900 shadow-lg transition-transform active:scale-95"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" fill="currentColor" />
            ) : (
              <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
            )}
          </button>

          {/* Forward 15s */}
          <button
            type="button"
            onClick={() => handleSkip(15)}
            className="relative text-white/70 transition-colors hover:text-white"
            aria-label="Forward 15 seconds"
          >
            <RotateCw className="h-7 w-7" />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
              15
            </span>
          </button>

          {/* Invisible spacer to balance speed button */}
          <div className="w-8" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
