'use client';

import { useEffect, useRef } from 'react';

/**
 * Auto-refresh the page when the tab has been backgrounded for too long.
 * Prevents memory bloat from long-lived SPA sessions accumulating requests/data.
 *
 * @param maxHiddenMs - Max time (ms) the tab can be hidden before triggering a refresh.
 *                      Default: 30 minutes.
 */
export function useStaleSession(maxHiddenMs = 30 * 60 * 1000) {
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current) {
        const elapsed = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (elapsed >= maxHiddenMs) {
          window.location.reload();
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [maxHiddenMs]);
}
