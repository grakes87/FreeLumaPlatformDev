'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Tracks how long an authenticated user listens to chapter audio.
 * Accumulates seconds while playing and periodically flushes to the server.
 */
export function useListenTracker(
  dailyContentId: number | null,
  isPlaying: boolean,
  currentTime: number,
  duration: number
) {
  const listenedSecondsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFlushRef = useRef(0);

  const flush = useCallback(
    (completed = false) => {
      const seconds = Math.floor(listenedSecondsRef.current);
      if (!dailyContentId || seconds <= 0) return;

      // Don't re-flush the same value
      if (seconds === lastFlushRef.current && !completed) return;
      lastFlushRef.current = seconds;

      const body: { daily_content_id: number; listen_seconds: number; completed?: boolean } = {
        daily_content_id: dailyContentId,
        listen_seconds: seconds,
      };
      if (completed) body.completed = true;

      // Fire-and-forget — ignore 401 (unauthenticated) silently
      fetch('/api/listen-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    },
    [dailyContentId]
  );

  // Accumulate seconds while playing
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        listenedSecondsRef.current += 1;
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Flush on pause
      flush();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, flush]);

  // Periodic flush every 30 seconds while playing
  useEffect(() => {
    if (isPlaying) {
      flushIntervalRef.current = setInterval(() => {
        flush();
      }, 30_000);
    } else {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
    }

    return () => {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
    };
  }, [isPlaying, flush]);

  // Detect completion
  useEffect(() => {
    if (duration > 0 && currentTime >= duration - 1) {
      flush(true);
    }
  }, [currentTime, duration, flush]);

  // Flush on visibility change (tab hidden) and unmount
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        flush();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      // Flush on unmount
      flush();
    };
  }, [flush]);
}
