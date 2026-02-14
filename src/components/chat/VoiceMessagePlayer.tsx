'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface VoiceMessagePlayerProps {
  src: string;
  duration: number | null;
  isOwnMessage: boolean;
}

/** Number of waveform bars */
const BAR_COUNT = 32;

/**
 * Apple iMessage-style voice message player.
 *
 * Decodes the audio to extract real waveform peaks, renders them as bars,
 * and animates playback progress through the waveform.
 */
export function VoiceMessagePlayer({
  src,
  duration: serverDuration,
  isOwnMessage,
}: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(serverDuration ?? 0);
  const [peaks, setPeaks] = useState<number[] | null>(null);

  // Generate a deterministic waveform from the URL (used as seed).
  // We can't fetch() cross-origin B2 audio for decoding (CORS), and the
  // <audio> element can play it fine but doesn't expose raw PCM data.
  // This produces a natural-looking, unique waveform per message.
  useEffect(() => {
    // Simple hash of URL to seed the waveform
    let hash = 0;
    for (let i = 0; i < src.length; i++) {
      hash = ((hash << 5) - hash + src.charCodeAt(i)) | 0;
    }
    const seed = Math.abs(hash);

    const bars: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const x = i / BAR_COUNT;
      // Multiple sine waves seeded by the URL hash for variety
      const s1 = Math.sin(x * Math.PI * (1.5 + (seed % 7) * 0.3));
      const s2 = Math.sin(x * (5 + (seed % 11)) + seed * 0.1) * 0.3;
      const s3 = Math.cos(x * (3 + (seed % 5)) + seed * 0.07) * 0.15;
      bars.push(Math.max(0.12, Math.min(1, 0.35 + s1 * 0.4 + s2 + s3)));
    }
    setPeaks(bars);
  }, [src]);

  // Set up audio element
  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = 'metadata';
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      cancelAnimationFrame(animRef.current);
    };

    return () => {
      cancelAnimationFrame(animRef.current);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [src]);

  // rAF loop for smooth playback progress
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    setCurrentTime(audio.currentTime);
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      cancelAnimationFrame(animRef.current);
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
      animRef.current = requestAnimationFrame(tick);
    }
  }, [isPlaying, tick]);

  // Seek by tapping on waveform
  const waveformRef = useRef<HTMLDivElement>(null);
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      const container = waveformRef.current;
      const audio = audioRef.current;
      if (!container || !audio || !audioDuration) return;

      const rect = container.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audioDuration;
      setCurrentTime(audio.currentTime);
    },
    [audioDuration]
  );

  const progress = audioDuration > 0 ? currentTime / audioDuration : 0;

  // Placeholder bars while decoding
  const displayPeaks = useMemo(() => {
    if (peaks) return peaks;
    const placeholder: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      placeholder.push(0.15);
    }
    return placeholder;
  }, [peaks]);

  const timeDisplay = isPlaying
    ? formatTime(currentTime)
    : formatTime(audioDuration);

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 min-w-[200px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Play / Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-90',
          isOwnMessage
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
        )}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" fill="currentColor" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
        )}
      </button>

      {/* Waveform */}
      <div
        ref={waveformRef}
        className="flex flex-1 items-center gap-[1.5px] h-8 cursor-pointer"
        onClick={handleSeek}
        role="slider"
        aria-label="Audio progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        {displayPeaks.map((peak, i) => {
          const barProgress = i / BAR_COUNT;
          const isPlayed = barProgress <= progress;
          // Min height 3px, max 28px
          const height = Math.max(3, Math.min(28, peak * 28));

          return (
            <div
              key={i}
              className={cn(
                'w-[2px] rounded-full transition-colors duration-100',
                isOwnMessage
                  ? isPlayed
                    ? 'bg-white'
                    : 'bg-white/35'
                  : isPlayed
                    ? 'bg-gray-700 dark:bg-gray-200'
                    : 'bg-gray-300 dark:bg-gray-600'
              )}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>

      {/* Duration / Time */}
      <span
        className={cn(
          'min-w-[2.5rem] shrink-0 text-right font-mono text-[11px] tabular-nums',
          isOwnMessage
            ? 'text-white/70'
            : 'text-gray-500 dark:text-gray-400'
        )}
      >
        {timeDisplay}
      </span>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
