'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { Gauge, Type, Minus, Plus, ArrowLeft } from 'lucide-react';

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'fl_teleprompter_settings';

interface TeleprompterSettings {
  speedIndex: number;
  textSizeIndex: number;
}

const DEFAULT_SETTINGS: TeleprompterSettings = {
  speedIndex: 3, // default to speed 4 of 8
  textSizeIndex: 3, // default to "L"
};

function loadSettings(): TeleprompterSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: TeleprompterSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Scroll speeds: px per frame at 60fps. 8 levels for fine control. */
const SCROLL_SPEEDS = [
  { label: '1', pxPerFrame: 0.2 },
  { label: '2', pxPerFrame: 0.4 },
  { label: '3', pxPerFrame: 0.7 },
  { label: '4', pxPerFrame: 1.0 },
  { label: '5', pxPerFrame: 1.4 },
  { label: '6', pxPerFrame: 1.8 },
  { label: '7', pxPerFrame: 2.4 },
  { label: '8', pxPerFrame: 3.2 },
] as const;

/** Text size options — includes very large sizes for reading at arm's length */
const TEXT_SIZES = [
  { label: 'XS', className: 'text-sm leading-relaxed' },
  { label: 'S', className: 'text-base leading-relaxed' },
  { label: 'M', className: 'text-lg leading-relaxed' },
  { label: 'L', className: 'text-xl leading-relaxed' },
  { label: 'XL', className: 'text-2xl leading-loose' },
  { label: '2X', className: 'text-3xl leading-loose' },
  { label: '3X', className: 'text-4xl leading-loose' },
  { label: '4X', className: 'text-5xl leading-loose' },
] as const;

const COUNTDOWN_SECONDS = 45;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TeleprompterProps {
  /** The script text to display (camera_script) */
  script: string;
  /** Ref to attach to the camera preview video element */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** The camera MediaStream to attach to the video element */
  stream: MediaStream | null;
  /** Whether the camera is actively recording */
  isRecording: boolean;
  /** Whether recording is paused */
  isPaused: boolean;
  /** Back navigation callback */
  onBack: () => void;
}

export function Teleprompter({ script, videoRef, stream, isRecording, isPaused, onBack }: TeleprompterProps) {
  const [settings, setSettings] = useState<TeleprompterSettings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [showControls, setShowControls] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef(0);
  const scrollAccumRef = useRef(0); // sub-pixel scroll accumulator
  const countdownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load saved settings on mount
  useEffect(() => {
    setMounted(true);
    setSettings(loadSettings());
  }, []);

  // Attach stream to video element inside this component (avoids race condition
  // with dynamic import — the parent's useEffect fires before this component mounts)
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef]);

  // Save settings whenever they change
  const updateSettings = useCallback((partial: Partial<TeleprompterSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  // Auto-hide controls after 3s of recording (show on pause)
  useEffect(() => {
    clearTimeout(controlsTimerRef.current);
    if (isRecording && !isPaused) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    } else {
      setShowControls(true);
    }
    return () => clearTimeout(controlsTimerRef.current);
  }, [isRecording, isPaused]);

  // Tap anywhere to briefly show controls while recording
  const handleTapControls = useCallback(() => {
    if (isRecording && !isPaused) {
      setShowControls(true);
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isRecording, isPaused]);

  // Auto-scroll the script while recording (pause when paused)
  // Uses a float accumulator so sub-pixel speeds (e.g. 0.2px/frame) still scroll.
  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);

    if (!isRecording || isPaused) {
      return;
    }

    const speed = SCROLL_SPEEDS[settings.speedIndex]?.pxPerFrame ?? 1.0;
    const el = scrollRef.current;
    if (!el) return;

    // Seed accumulator from current scroll position
    scrollAccumRef.current = el.scrollTop;

    const scroll = () => {
      if (el.scrollTop < el.scrollHeight - el.clientHeight) {
        scrollAccumRef.current += speed;
        const target = Math.floor(scrollAccumRef.current);
        if (target !== el.scrollTop) {
          el.scrollTop = target;
        }
      }
      animFrameRef.current = requestAnimationFrame(scroll);
    };

    animFrameRef.current = requestAnimationFrame(scroll);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRecording, isPaused, settings.speedIndex]);

  // Countdown timer while recording (pauses when paused)
  useEffect(() => {
    if (!isRecording) {
      setCountdown(COUNTDOWN_SECONDS);
      clearInterval(countdownRef.current);
      return;
    }

    if (isPaused) {
      clearInterval(countdownRef.current);
      return;
    }

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
  }, [isRecording, isPaused]);

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

  const textSizeClass = TEXT_SIZES[settings.textSizeIndex]?.className ?? TEXT_SIZES[3].className;

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black" onClick={handleTapControls}>
      {/* Camera preview - mirrored for selfie view, fullscreen behind everything */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Fullscreen script overlay - semi-transparent so camera shows through */}
      <div className="absolute inset-0 z-10 flex flex-col">
        {/* Row 1: Back + REC indicator + Timer */}
        <div
          className={cn(
            'relative z-20 flex items-center justify-between px-3 pt-3 pb-1 transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0'
          )}
        >
          {/* Back button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onBack(); }}
            className="flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {/* Recording indicator (center) */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            {isRecording && !isPaused && (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
                </span>
                <span className="text-xs font-semibold text-red-400">REC</span>
              </>
            )}
            {isPaused && (
              <span className="rounded-full bg-amber-500/80 px-2.5 py-0.5 text-xs font-semibold text-white">
                PAUSED
              </span>
            )}
          </div>

          {/* Countdown timer */}
          {isRecording ? (
            <div
              className={cn(
                'rounded-full bg-black/50 px-3 py-1 text-sm font-mono font-bold backdrop-blur-sm',
                timerColor,
                countdown <= 5 && countdown > 0 && !isPaused && 'animate-pulse'
              )}
            >
              {timerDisplay}
            </div>
          ) : (
            <div className="w-16" /> /* spacer when not recording */
          )}
        </div>

        {/* Fullscreen scrollable script area */}
        <div
          ref={scrollRef}
          className="relative z-10 flex-1 overflow-y-auto bg-black/40 px-6 py-4 backdrop-blur-[2px]"
        >
          {/* Top fade */}
          <div className="pointer-events-none sticky -top-4 -mt-4 h-10 bg-gradient-to-b from-black/40 to-transparent" />

          <p
            className={cn(
              'whitespace-pre-wrap text-center font-medium text-white drop-shadow-lg',
              textSizeClass
            )}
          >
            {script}
          </p>

          {/* Bottom padding so text can scroll fully past the recording controls */}
          <div className="h-56" />
        </div>

        {/* Speed + Text size controls — below script, above recording buttons */}
        <div
          className={cn(
            'relative z-20 flex items-center justify-between px-3 py-2 transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          {/* Speed control */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Gauge className="mr-0.5 h-3.5 w-3.5 text-white/50" />
            <button
              type="button"
              onClick={() => updateSettings({ speedIndex: Math.max(0, settings.speedIndex - 1) })}
              disabled={settings.speedIndex === 0}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm disabled:opacity-30"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-[1.5rem] text-center text-xs font-medium text-white/80">
              {SCROLL_SPEEDS[settings.speedIndex]?.label}
            </span>
            <button
              type="button"
              onClick={() => updateSettings({ speedIndex: Math.min(SCROLL_SPEEDS.length - 1, settings.speedIndex + 1) })}
              disabled={settings.speedIndex === SCROLL_SPEEDS.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm disabled:opacity-30"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Text size control */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Type className="mr-0.5 h-3.5 w-3.5 text-white/50" />
            <button
              type="button"
              onClick={() => updateSettings({ textSizeIndex: Math.max(0, settings.textSizeIndex - 1) })}
              disabled={settings.textSizeIndex === 0}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm disabled:opacity-30"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-[1.5rem] text-center text-xs font-medium text-white/80">
              {TEXT_SIZES[settings.textSizeIndex]?.label}
            </span>
            <button
              type="button"
              onClick={() => updateSettings({ textSizeIndex: Math.min(TEXT_SIZES.length - 1, settings.textSizeIndex + 1) })}
              disabled={settings.textSizeIndex === TEXT_SIZES.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm disabled:opacity-30"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
