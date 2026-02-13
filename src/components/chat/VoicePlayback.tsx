'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface VoicePlaybackProps {
  /** URL of the voice message audio file */
  mediaUrl: string;
  /** Duration of the recording in seconds */
  duration: number;
  /** Whether this message was sent by the current user (affects bubble color) */
  isMine?: boolean;
}

/** Number of static waveform bars */
const BAR_COUNT = 24;

/**
 * Voice message playback component for chat message bubbles.
 *
 * - Play/Pause toggle with HTML5 Audio
 * - Static proportional waveform bars (standard WhatsApp approach:
 *   recording uses live AnalyserNode, playback uses static bars)
 * - Progress fills bars left-to-right as audio plays
 * - Duration display shows remaining time during playback
 * - Loading spinner while audio buffers
 */
export function VoicePlayback({
  mediaUrl,
  duration,
  isMine = false,
}: VoicePlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  // Generate deterministic bar heights based on duration
  // This creates a natural-looking static waveform pattern
  const barHeights = useRef<number[]>(
    Array.from({ length: BAR_COUNT }, (_, i) => {
      // Deterministic pseudo-random based on index and duration
      const seed = ((i + 1) * 7 + Math.floor(duration * 13)) % 100;
      const base = 0.3 + (seed / 100) * 0.7;
      // Add center emphasis
      const center = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
      return Math.min(1, base * (0.7 + center * 0.3));
    })
  ).current;

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = mediaUrl;
    audioRef.current = audio;

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      cancelAnimationFrame(animFrameRef.current);
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.pause();
      audio.src = '';
    };
  }, [mediaUrl]);

  // Progress animation loop
  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    const dur = audio.duration || duration;
    setCurrentTime(audio.currentTime);
    setProgress(dur > 0 ? audio.currentTime / dur : 0);
    animFrameRef.current = requestAnimationFrame(updateProgress);
  }, [duration]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      cancelAnimationFrame(animFrameRef.current);
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      try {
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
        animFrameRef.current = requestAnimationFrame(updateProgress);
      } catch {
        setIsLoading(false);
      }
    }
  }, [isPlaying, updateProgress]);

  // Format seconds to M:SS
  const formatTime = (seconds: number): string => {
    const s = Math.round(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Show remaining time during playback, total duration when stopped
  const displayTime = isPlaying
    ? formatTime(Math.max(0, duration - currentTime))
    : formatTime(duration);

  return (
    <div
      className="flex items-center gap-2.5 py-1"
      role="region"
      aria-label={`Voice message, ${formatTime(duration)}`}
    >
      {/* Play/Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
          isMine
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-black/10 text-gray-700 hover:bg-black/15 dark:bg-white/15 dark:text-white dark:hover:bg-white/20',
          'disabled:opacity-50'
        )}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? (
          <div
            className={cn(
              'h-4 w-4 animate-spin rounded-full border-2 border-t-current',
              isMine ? 'border-white/30' : 'border-gray-300 dark:border-white/30'
            )}
          />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px]" />
        )}
      </button>

      {/* Waveform bars */}
      <div
        className="flex flex-1 items-center gap-[2px]"
        aria-hidden="true"
      >
        {barHeights.map((height, i) => {
          const barProgress = BAR_COUNT > 0 ? i / BAR_COUNT : 0;
          const isFilled = progress > barProgress;
          const barH = height * 24 + 3; // 3px min, 27px max

          return (
            <div
              key={i}
              className={cn(
                'w-[2px] rounded-full transition-colors duration-150',
                isFilled
                  ? isMine
                    ? 'bg-white'
                    : 'bg-blue-500 dark:bg-blue-400'
                  : isMine
                    ? 'bg-white/30'
                    : 'bg-gray-300 dark:bg-white/25'
              )}
              style={{ height: `${barH}px` }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span
        className={cn(
          'min-w-[2.5rem] text-right font-mono text-[11px] tabular-nums',
          isMine
            ? 'text-white/70'
            : 'text-gray-500 dark:text-white/50'
        )}
      >
        {displayTime}
      </span>
    </div>
  );
}
