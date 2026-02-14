'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Subtitles,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useImmersive } from '@/context/ImmersiveContext';
import { useVideoProgress } from '@/hooks/useVideoProgress';

interface VideoPlayerProps {
  videoUrl: string;
  captionUrl: string | null;
  duration: number;
  videoId: number;
  initialProgress: {
    watched_seconds: number;
    last_position: number;
    duration_seconds: number;
    completed: boolean;
  } | null;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Full-screen immersive video player with custom controls.
 * Uses native HTML5 <video> element.
 * Hides bottom nav via ImmersiveContext.
 */
export function VideoPlayer({
  videoUrl,
  captionUrl,
  duration,
  videoId,
  initialProgress,
  onClose,
}: VideoPlayerProps) {
  const { setImmersive } = useImmersive();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration || 0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [isLoading, setIsLoading] = useState(true);   // initial load before first play
  const [isBuffering, setIsBuffering] = useState(false); // mid-playback stall
  const [bufferPercent, setBufferPercent] = useState(0);

  const {
    startPosition,
    updateProgress,
    saveProgress,
    onPlay: onProgressPlay,
    onPause: onProgressPause,
  } = useVideoProgress({
    videoId,
    durationSeconds: duration,
    initialProgress,
  });

  // Set immersive mode on mount, clear on unmount
  useEffect(() => {
    setImmersive(true);
    // Scroll to hide Safari address bar
    window.scrollTo(0, 1);
    return () => {
      setImmersive(false);
    };
  }, [setImmersive]);

  // Force landscape: use actual window.innerWidth/innerHeight for accurate sizing
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsPortrait(h > w);
      setViewportSize({ w, h });
    };
    measure();

    // Try native fullscreen + orientation lock (Android Chrome)
    const tryNativeFullscreen = async () => {
      try {
        const el = containerRef.current;
        if (el?.requestFullscreen) {
          await el.requestFullscreen();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const orient = screen.orientation as any;
          if (orient?.lock) {
            await orient.lock('landscape');
          }
          // Native fullscreen worked — no CSS rotation needed
          setIsPortrait(false);
          return;
        }
      } catch {
        // Not supported — CSS rotation fallback handles it
      }
    };
    tryNativeFullscreen();

    window.addEventListener('resize', measure);
    // Also listen for orientation change (fires on iOS before resize sometimes)
    window.addEventListener('orientationchange', () => setTimeout(measure, 100));
    return () => {
      window.removeEventListener('resize', measure);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (screen.orientation as any)?.unlock?.();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {
        // ignore
      }
    };
  }, []);

  // Handle device/browser back button: push a history entry so back closes the player
  useEffect(() => {
    history.pushState({ videoPlayer: true }, '');
    const onPopState = () => {
      onClose();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [onClose]);

  // Set start position when video is ready
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setVideoDuration(video.duration || duration);
    if (startPosition > 0 && startPosition < (video.duration || duration)) {
      video.currentTime = startPosition;
    }
  }, [startPosition, duration]);

  // Compute how much of the video is buffered (as a percentage of total duration)
  const updateBufferProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const buffered = video.buffered;
    if (buffered.length > 0) {
      // Find the buffer range that contains (or is closest ahead of) currentTime
      let bufferedEnd = 0;
      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) <= video.currentTime) {
          bufferedEnd = Math.max(bufferedEnd, buffered.end(i));
        }
      }
      setBufferPercent(Math.round((bufferedEnd / video.duration) * 100));
    }
  }, []);

  // Auto-play once browser has enough data
  const handleCanPlayThrough = useCallback(() => {
    setIsLoading(false);
    setIsBuffering(false);
    if (!hasStarted) {
      const video = videoRef.current;
      if (video) {
        video.play().catch(() => {
          // Autoplay blocked — user will see the play button
        });
        setHasStarted(true);
      }
    }
  }, [hasStarted]);

  // canplay fires earlier than canplaythrough — start playing sooner
  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
    if (!hasStarted) {
      const video = videoRef.current;
      if (video) {
        video.play().catch(() => {});
        setHasStarted(true);
      }
    }
  }, [hasStarted]);

  // Mid-playback stall: show buffering spinner
  const handleWaiting = useCallback(() => {
    // Only show buffering UI if playback already started (not initial load)
    if (hasStarted) {
      setIsBuffering(true);
      setShowControls(true);
    }
  }, [hasStarted]);

  const handlePlaying = useCallback(() => {
    setIsLoading(false);
    setIsBuffering(false);
  }, []);

  // Time update handler — also updates buffer progress
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || isSeeking) return;
    setCurrentTime(video.currentTime);
    updateProgress(video.currentTime);
    updateBufferProgress();
  }, [updateProgress, isSeeking, updateBufferProgress]);

  // Also track buffer progress during loading
  const handleProgress = useCallback(() => {
    updateBufferProgress();
  }, [updateBufferProgress]);

  // Play/Pause handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setIsLoading(false);
    setIsBuffering(false);
    onProgressPlay();
    resetHideTimer();
  }, [onProgressPlay]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onProgressPause();
    setShowControls(true);
  }, [onProgressPause]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onProgressPause();
    setShowControls(true);
  }, [onProgressPause]);

  // Controls visibility
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Update hide timer when playing state changes
  useEffect(() => {
    if (isPlaying) {
      resetHideTimer();
    } else {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, resetHideTimer]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    resetHideTimer();
  }, [resetHideTimer]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // Toggle captions
  const toggleCaptions = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const track = video.textTracks[0];
    if (track) {
      const newState = !captionsOn;
      track.mode = newState ? 'showing' : 'hidden';
      setCaptionsOn(newState);
    }
  }, [captionsOn]);

  // Handle close (in-app back button): pop the history entry, which triggers popstate → onClose
  const handleClose = useCallback(() => {
    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
    saveProgress();
    history.back();
  }, [saveProgress]);

  // Compute seek ratio from a pointer/touch event.
  // When the player is CSS-rotated 90deg, the visual X-axis maps to screen Y-axis,
  // so we need to use clientY and the rect's top/height instead.
  const getSeekRatio = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!seekBarRef.current) return null;
      const rect = seekBarRef.current.getBoundingClientRect();
      if (isPortrait) {
        // Rotated: visual left-to-right maps to screen top-to-bottom
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    [isPortrait]
  );

  // Seek bar interaction
  const handleSeekStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!videoRef.current) return;
      setIsSeeking(true);
      const ratio = getSeekRatio(e);
      if (ratio === null) return;
      const newTime = ratio * videoDuration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      resetHideTimer();
    },
    [videoDuration, resetHideTimer, getSeekRatio]
  );

  const handleSeekMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!isSeeking || !videoRef.current) return;
      const ratio = getSeekRatio(e);
      if (ratio === null) return;
      const newTime = ratio * videoDuration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [isSeeking, videoDuration, getSeekRatio]
  );

  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false);
  }, []);

  // Handle container tap for show/hide controls
  const handleContainerTap = useCallback(() => {
    if (showControls && isPlaying) {
      setShowControls(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      resetHideTimer();
    }
  }, [showControls, isPlaying, resetHideTimer]);

  // Initialize captions to hidden
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTrackLoaded = () => {
      const track = video.textTracks[0];
      if (track) {
        track.mode = 'hidden';
      }
    };
    video.addEventListener('loadedmetadata', handleTrackLoaded);
    return () => {
      video.removeEventListener('loadedmetadata', handleTrackLoaded);
    };
  }, []);

  const progressPercent =
    videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

  // When portrait, rotate: width becomes viewport height, height becomes viewport width
  const portraitStyle: React.CSSProperties | undefined = isPortrait && viewportSize.w > 0
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: `${viewportSize.h}px`,
        height: `${viewportSize.w}px`,
        transform: `rotate(90deg) translateY(-${viewportSize.w}px)`,
        transformOrigin: 'top left',
      }
    : undefined;

  return createPortal(
    <div
      ref={containerRef}
      className={cn('fixed inset-0 z-50 bg-black', isPortrait && 'overflow-hidden')}
      style={portraitStyle}
    >
      {/* Video element — pointer-events-none so clicks fall through to controls overlay */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="pointer-events-none h-full w-full object-contain"
        playsInline
        preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onCanPlayThrough={handleCanPlayThrough}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onProgress={handleProgress}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
      >
        {captionUrl && (
          <track
            kind="subtitles"
            src={captionUrl}
            srcLang="en"
            label="English"
          />
        )}
      </video>

      {/* Controls overlay — always interactive so taps toggle visibility */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleContainerTap}
      >
        {/* Top bar: close button */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-4 pb-12 pt-[env(safe-area-inset-top,0px)]" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleClose}
            className="mt-3 flex items-center gap-1 text-white/90 active:text-white"
          >
            <ArrowLeft className="h-6 w-6" />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>

        {/* Center: loading / buffering / play-pause */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {isLoading ? (
            /* Initial loading spinner */
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
              <span className="text-sm font-medium text-white/70">Loading</span>
            </div>
          ) : isBuffering ? (
            /* Mid-playback buffering with progress ring */
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="4" />
                  <circle
                    cx="40" cy="40" r="34" fill="none" stroke="white" strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - bufferPercent / 100)}`}
                    className="transition-[stroke-dashoffset] duration-300"
                  />
                </svg>
                <span className="absolute text-sm font-semibold tabular-nums text-white">
                  {bufferPercent}%
                </span>
              </div>
              <span className="text-xs font-medium text-white/70">Buffering</span>
            </div>
          ) : (
            /* Play / Pause button */
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm active:scale-90"
            >
              {isPlaying ? (
                <Pause className="h-8 w-8" fill="currentColor" />
              ) : (
                <Play className="h-8 w-8" fill="currentColor" />
              )}
            </button>
          )}
        </div>

        {/* Bottom bar: seek + controls */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-[env(safe-area-inset-bottom,0px)] pt-12" onClick={(e) => e.stopPropagation()}>
          {/* Seek bar */}
          <div
            ref={seekBarRef}
            className="relative mb-3 h-5 cursor-pointer touch-none"
            onMouseDown={handleSeekStart}
            onMouseMove={handleSeekMove}
            onMouseUp={handleSeekEnd}
            onMouseLeave={handleSeekEnd}
            onTouchStart={handleSeekStart}
            onTouchMove={handleSeekMove}
            onTouchEnd={handleSeekEnd}
          >
            {/* Track background */}
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20">
              {/* Buffer fill (gray) */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                style={{ width: `${bufferPercent}%` }}
              />
              {/* Playback progress fill */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Thumb */}
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-lg"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          {/* Controls row */}
          <div className="mb-3 flex items-center justify-between">
            {/* Time display */}
            <span className="text-xs font-medium tabular-nums text-white/80">
              {formatTime(currentTime)} / {formatTime(videoDuration)}
            </span>

            {/* Right controls */}
            <div className="flex items-center gap-4">
              {/* Volume */}
              <button
                type="button"
                onClick={toggleMute}
                className="text-white/80 active:text-white"
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>

              {/* Captions */}
              {captionUrl && (
                <button
                  type="button"
                  onClick={toggleCaptions}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-white/80 active:text-white',
                    captionsOn && 'bg-white/20'
                  )}
                >
                  <Subtitles className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
