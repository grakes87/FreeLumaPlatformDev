'use client';

import { useState, useCallback } from 'react';

export type FollowStatus = 'active' | 'pending' | 'none';

interface UseFollowOptions {
  userId: number;
  initialStatus: FollowStatus;
}

interface UseFollowReturn {
  status: FollowStatus;
  loading: boolean;
  toggleFollow: () => Promise<void>;
}

/**
 * Hook to manage follow/unfollow state for a single user.
 * Provides optimistic updates with automatic rollback on error.
 */
export function useFollow({ userId, initialStatus }: UseFollowOptions): UseFollowReturn {
  const [status, setStatus] = useState<FollowStatus>(initialStatus);
  const [loading, setLoading] = useState(false);

  const toggleFollow = useCallback(async () => {
    if (loading) return;

    const prevStatus = status;
    setLoading(true);

    try {
      if (status === 'active' || status === 'pending') {
        // Optimistic: set to none
        setStatus('none');

        const res = await fetch(`/api/follows/${userId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Failed to unfollow');
        }
      } else {
        // Optimistic: set to active (will correct to pending from server)
        setStatus('active');

        const res = await fetch(`/api/follows/${userId}`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Failed to follow');
        }

        const data = await res.json();
        // Server returns actual status (active or pending for private profiles)
        setStatus(data.status as FollowStatus);
      }
    } catch {
      // Rollback on error
      setStatus(prevStatus);
    } finally {
      setLoading(false);
    }
  }, [userId, status, loading]);

  return { status, loading, toggleFollow };
}
