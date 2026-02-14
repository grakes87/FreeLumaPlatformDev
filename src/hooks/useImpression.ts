'use client';

import { useEffect, useRef } from 'react';

/** Set of post IDs already recorded in this session to avoid duplicate requests */
const recorded = new Set<number>();

/**
 * Records a view impression for a post when it scrolls into view.
 * Uses IntersectionObserver with a threshold (50% visible for 1s).
 * Each post is only recorded once per browser session.
 */
export function useImpression(postId: number | null | undefined) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!postId || recorded.has(postId)) return;

    const el = elementRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Wait 1 second of visibility before recording
          timerRef.current = setTimeout(() => {
            if (!recorded.has(postId)) {
              recorded.add(postId);
              fetch(`/api/posts/${postId}/impression`, {
                method: 'POST',
                credentials: 'include',
              }).catch(() => {});
            }
          }, 1000);
        } else {
          // Scrolled away before 1s — cancel
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [postId]);

  return elementRef;
}
