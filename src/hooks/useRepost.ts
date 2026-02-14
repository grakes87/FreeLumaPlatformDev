'use client';

import { useState, useCallback, useRef } from 'react';

interface RepostResult {
  post: Record<string, unknown>;
  original_post: Record<string, unknown>;
  flagged: boolean;
}

export function useRepost() {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const createRepost = useCallback(async (originalPostId: number, body: string): Promise<RepostResult | null> => {
    if (submittingRef.current) return null;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const res = await fetch('/api/reposts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ original_post_id: originalPostId, body }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create repost');
      }

      return await res.json() as RepostResult;
    } catch (error) {
      console.error('[useRepost] error:', error);
      throw error;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, []);

  return { submitting, createRepost };
}
