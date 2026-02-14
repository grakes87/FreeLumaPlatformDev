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
    return () => {
      setImmersive(false);
    };
  }, [setImmersive]);

  // Set start position when video is ready
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setVideoDuration(video.duration || duration);
    if (startPosition > 0 && startPosition < (video.duration || duration)) {
      video.currentTime = startPosition;
    }
  }, [startPosition, duration]);

  // Auto-play on mount after metadata loaded
  const handleCanPlay = useCallback(() => {
    if (!hasStarted) {
      const video = videoRef.current;
      if (video) {
        video.play().catch(() => {
          // Autoplay may be blocked; user will tap play
        });
        setHasStarted(true);
      }
    }
  }, [hasStarted]);

  // Time update handler
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || isSeeking) return;
    setCurrentTime(video.currentTime);
    updateProgress(video.currentTime);
  }, [updateProgress, isSeeking]);

  // Play/Pause handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
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

  // Handle close
  const handleClose = useCallback(() => {
    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
    saveProgress();
    onClose();
  }, [saveProgress, onClose]);

  // Seek bar interaction
  const handleSeekStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!seekBarRef.current || !videoRef.current) return;
      setIsSeeking(true);
      const rect = seekBarRef.current.getBoundingClientRect();
      const clientX =
        'touches' in e ? e.touches[0].clientX : e.clientX;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newTime = ratio * videoDuration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      resetHideTimer();
    },
    [videoDuration, resetHideTimer]
  );

  const handleSeekMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!isSeeking || !seekBarRef.current || !videoRef.current) return;
      const rect = seekBarRef.current.getBoundingClientRect();
      const clientX =
        'touches' in e ? e.touches[0].clientX : e.clientX;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newTime = ratio * videoDuration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [isSeeking, videoDuration]
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

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black"
      onClick={handleContainerTap}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="h-full w-full object-contain"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onClick={(e) => e.stopPropagation()}
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

      {/* Controls overlay */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar: close button */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-4 pb-12 pt-[env(safe-area-inset-top,0px)]">
          <button
            type="button"
            onClick={handleClose}
            className="mt-3 flex items-center gap-1 text-white/90 active:text-white"
          >
            <ArrowLeft className="h-6 w-6" />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>

        {/* Center play/pause */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={togglePlayPause}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm active:scale-90"
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" fill="currentColor" />
            ) : (
              <Play className="h-8 w-8" fill="currentColor" />
            )}
          </button>
        </div>

        {/* Bottom bar: seek + controls */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-[env(safe-area-inset-bottom,0px)] pt-12">
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
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/30">
              {/* Progress fill */}
              <div
                className="h-full rounded-full bg-primary"
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
