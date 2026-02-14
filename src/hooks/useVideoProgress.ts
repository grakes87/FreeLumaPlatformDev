'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface VideoProgressData {
  watched_seconds: number;
  last_position: number;
  duration_seconds: number;
  completed: boolean;
}

interface UseVideoProgressOptions {
  videoId: number;
  durationSeconds: number;
  initialProgress: VideoProgressData | null;
}

/**
 * Hook for saving/loading video watch progress.
 * - Auto-saves every 10 seconds during active playback.
 * - Saves on pause and on unmount.
 * - Marks completed when watched_seconds >= 75% of duration.
 * - Returns lastPosition for resume playback.
 */
export function useVideoProgress({
  videoId,
  durationSeconds,
  initialProgress,
}: UseVideoProgressOptions) {
  const [watchedSeconds, setWatchedSeconds] = useState(
    initialProgress?.watched_seconds ?? 0
  );
  const [lastPosition, setLastPosition] = useState(
    initialProgress?.last_position ?? 0
  );
  const [completed, setCompleted] = useState(
    initialProgress?.completed ?? false
  );

  const watchedRef = useRef(watchedSeconds);
  const positionRef = useRef(lastPosition);
  const completedRef = useRef(completed);
  const isPlayingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedRef = useRef(false); // track if save is needed

  // Keep refs in sync
  useEffect(() => {
    watchedRef.current = watchedSeconds;
  }, [watchedSeconds]);

  useEffect(() => {
    positionRef.current = lastPosition;
  }, [lastPosition]);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  // Save progress to API
  const saveProgress = useCallback(async () => {
    if (savedRef.current) return; // No changes since last save

    try {
      await fetch(`/api/videos/${videoId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          watched_seconds: Math.floor(watchedRef.current),
          duration_seconds: durationSeconds,
          last_position: Math.floor(positionRef.current),
          completed: completedRef.current,
        }),
      });
      savedRef.current = true;
    } catch (err) {
      console.error('[useVideoProgress] save error:', err);
    }
  }, [videoId, durationSeconds]);

  // Update progress from video timeupdate event
  const updateProgress = useCallback(
    (currentTime: number) => {
      positionRef.current = currentTime;
      setLastPosition(currentTime);

      // Increment watched_seconds (cumulative)
      if (currentTime > watchedRef.current) {
        watchedRef.current = currentTime;
        setWatchedSeconds(currentTime);
      }

      // Mark completed at 75%
      if (
        !completedRef.current &&
        durationSeconds > 0 &&
        watchedRef.current >= durationSeconds * 0.75
      ) {
        completedRef.current = true;
        setCompleted(true);
      }

      savedRef.current = false; // mark as dirty
    },
    [durationSeconds]
  );

  // Start auto-save interval during playback
  const onPlay = useCallback(() => {
    isPlayingRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (isPlayingRef.current) {
        saveProgress();
      }
    }, 10_000); // Save every 10 seconds
  }, [saveProgress]);

  // Pause: stop interval + save immediately
  const onPause = useCallback(() => {
    isPlayingRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    saveProgress();
  }, [saveProgress]);

  // Cleanup: save on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Fire-and-forget save on unmount
      if (!savedRef.current) {
        const body = JSON.stringify({
          watched_seconds: Math.floor(watchedRef.current),
          duration_seconds: durationSeconds,
          last_position: Math.floor(positionRef.current),
          completed: completedRef.current,
        });
        // Use keepalive fetch for reliable unmount save (preserves cookies/auth)
        fetch(`/api/videos/${videoId}/progress`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    watchedSeconds,
    lastPosition,
    completed,
    startPosition: initialProgress?.completed ? 0 : (initialProgress?.last_position ?? 0),
    updateProgress,
    saveProgress,
    onPlay,
    onPause,
  };
}
