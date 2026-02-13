'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Safe hook that returns true when the user has any unread chat messages.
 * Fetches the conversation list on mount and refreshes periodically (60s)
 * and on window focus. Returns false when not authenticated.
 */
export function useChatUnreadBadge(): boolean {
  const [hasUnread, setHasUnread] = useState(false);
  const { isAuthenticated } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const checkUnread = useCallback(async () => {
    if (!isAuthenticated) {
      setHasUnread(false);
      return;
    }

    try {
      const res = await fetch('/api/chat/conversations', {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();

      // Check if any conversation has unread_count > 0
      const conversations: Array<{ unread_count?: number }> = data.conversations || [];
      setHasUnread(conversations.some((c) => (c.unread_count ?? 0) > 0));
    } catch {
      // Silently fail - badge is non-critical
    }
  }, [isAuthenticated]);

  // Initial check + periodic refresh
  useEffect(() => {
    if (!isAuthenticated) {
      setHasUnread(false);
      return;
    }

    checkUnread();
    intervalRef.current = setInterval(checkUnread, 60000);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, checkUnread]);

  // Refresh on window focus
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleFocus = () => checkUnread();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthenticated, checkUnread]);

  return hasUnread;
}
