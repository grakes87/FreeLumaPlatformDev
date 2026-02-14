'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Returns a stable viewport height in pixels that tracks iOS Safari's
 * visual viewport (accounts for toolbar show/hide).
 *
 * Uses `window.visualViewport.height` when available, falling back to
 * `window.innerHeight`. On resize, re-snaps a scroll container to the
 * active card index so content doesn't jump.
 */
export function useStableViewportHeight() {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      setHeight(h);
    };

    // Initial measurement
    update();

    // Track both visualViewport (iOS toolbar) and window resize (orientation)
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);

    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // CSS value — pixels when measured, dvh fallback during SSR
  const heightStyle = height !== null ? `${height}px` : '100dvh';

  return { height, heightStyle };
}
