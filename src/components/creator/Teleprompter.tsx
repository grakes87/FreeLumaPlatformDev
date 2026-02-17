'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { Gauge, ChevronDown, ChevronUp } from 'lucide-react';

interface TeleprompterProps {
  /** The script text to display (camera_script) */
  script: string;
  /** Ref to attach to the camera preview video element */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Whether the camera is actively recording */
  isRecording: boolean;
}

/** Scroll speed options: pixels per frame at 60fps */
const SCROLL_SPEEDS = [
  { label: 'Slow', pxPerFrame: 0.5 },
  { label: 'Medium', pxPerFrame: 1.2 },
  { label: 'Fast', pxPerFrame: 2.0 },
] as const;

const COUNTDOWN_SECONDS = 45;

/**
 * Full-screen teleprompter overlay with:
 * - Mirrored camera preview (background)
 * - Semi-transparent script overlay on bottom 40%
 * - Auto-scrolling script at adjustable speed
 * - 45-second countdown timer
 * - Red pulsing recording indicator
 */
export function Teleprompter({ script, videoRef, isRecording }: TeleprompterProps) {
  const [speedIndex, setSpeedIndex] = useState(1); // default Medium
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [scriptExpanded, setScriptExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Auto-scroll the script while recording
  useEffect(() => {
    if (!isRecording || !scriptExpanded) {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const speed = SCROLL_SPEEDS[speedIndex].pxPerFrame;
    const el = scrollRef.current;
    if (!el) return;

    const scroll = () => {
      if (el.scrollTop < el.scrollHeight - el.clientHeight) {
        el.scrollTop += speed;
      }
      animFrameRef.current = requestAnimationFrame(scroll);
    };

    animFrameRef.current = requestAnimationFrame(scroll);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRecording, speedIndex, scriptExpanded]);

  // Countdown timer while recording
  useEffect(() => {
    if (!isRecording) {
      setCountdown(COUNTDOWN_SECONDS);
      clearInterval(countdownRef.current);
      return;
    }

    setCountdown(COUNTDOWN_SECONDS);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownRef.current);
    };
  }, [isRecording]);

  // Reset scroll position when recording starts
  useEffect(() => {
    if (isRecording && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [isRecording]);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((prev) => (prev + 1) % SCROLL_SPEEDS.length);
  }, []);

  const toggleScript = useCallback(() => {
    setScriptExpanded((prev) => !prev);
  }, []);

  // Format countdown as MM:SS
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timerDisplay =
    countdown <= 0
      ? 'TIME'
      : `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const timerColor =
    countdown <= 0
      ? 'text-red-500'
      : countdown <= 5
        ? 'text-red-400'
        : countdown <= 10
          ? 'text-amber-400'
          : 'text-white';

  return (
    <div className="fixed inset-0 z-40 bg-black">
      {/* Camera preview - mirrored for selfie view */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Top bar: recording indicator + timer */}
      <div className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3">
        {/* Recording indicator */}
        <div className="flex items-center gap-2">
          {isRecording && (
            <>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
              </span>
              <span className="text-xs font-semibold text-red-400">REC</span>
            </>
          )}
        </div>

        {/* Countdown timer */}
        {isRecording && (
          <div
            className={cn(
              'rounded-full bg-black/50 px-3 py-1 text-sm font-mono font-bold backdrop-blur-sm',
              timerColor,
              countdown <= 5 && countdown > 0 && 'animate-pulse'
            )}
          >
            {timerDisplay}
          </div>
        )}
      </div>

      {/* Speed control - top right, below timer bar */}
      <div className="absolute right-3 top-14 z-50">
        <button
          type="button"
          onClick={cycleSpeed}
          className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70"
          aria-label={`Scroll speed: ${SCROLL_SPEEDS[speedIndex].label}`}
        >
          <Gauge className="h-3.5 w-3.5" />
          {SCROLL_SPEEDS[speedIndex].label}
        </button>
      </div>

      {/* Script overlay - bottom portion */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 z-50 transition-all duration-300',
          scriptExpanded ? 'h-[40%]' : 'h-12'
        )}
      >
        {/* Collapse/expand toggle */}
        <button
          type="button"
          onClick={toggleScript}
          className="flex w-full items-center justify-center bg-gradient-to-b from-transparent to-black/40 py-1"
          aria-label={scriptExpanded ? 'Collapse script' : 'Expand script'}
        >
          {scriptExpanded ? (
            <ChevronDown className="h-5 w-5 text-white/60" />
          ) : (
            <ChevronUp className="h-5 w-5 text-white/60" />
          )}
        </button>

        {/* Scrollable script area */}
        {scriptExpanded && (
          <div
            ref={scrollRef}
            className="h-[calc(100%-2rem)] overflow-y-auto bg-black/40 px-6 py-4 backdrop-blur-sm"
          >
            {/* Top fade gradient */}
            <div className="pointer-events-none sticky -top-4 -mt-4 h-8 bg-gradient-to-b from-black/40 to-transparent" />

            <p className="whitespace-pre-wrap text-center text-lg font-medium leading-relaxed text-white drop-shadow-lg">
              {script}
            </p>

            {/* Bottom padding so text can scroll fully */}
            <div className="h-32" />
          </div>
        )}
      </div>
    </div>
  );
}
