'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import type { NotificationPayload } from '@/lib/notifications/types';

/** Toast notification item with metadata for display and routing */
export interface NotificationToastItem {
  id: number;
  type: string;
  actor_display_name: string;
  actor_avatar_url: string | null;
  actor_avatar_color: string;
  preview_text: string | null;
  entity_type: string;
  entity_id: number;
  timestamp: number;
}

export interface NotificationContextValue {
  /** Global unread notification count for badge display */
  unreadCount: number;
  /** Queue of toasts waiting to be shown */
  toastQueue: NotificationToastItem[];
  /** Currently visible toast (one at a time) */
  currentToast: NotificationToastItem | null;
  /** Dismiss the current toast */
  dismissToast: () => void;
  /** Refresh the unread count from the server */
  refreshUnreadCount: () => Promise<void>;
  /** Decrement unread count (e.g., after marking one as read) */
  decrementUnread: (amount?: number) => void;
  /** Reset unread count to zero */
  clearUnreadCount: () => void;
}

/** Exported for safe access from useNotificationBadge (returns null when outside provider) */
export const NotificationContext = createContext<NotificationContextValue | null>(null);

const TOAST_AUTO_DISMISS_MS = 3500;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { notifSocket } = useSocket();
  const { isAuthenticated } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [toastQueue, setToastQueue] = useState<NotificationToastItem[]>([]);
  const [currentToast, setCurrentToast] = useState<NotificationToastItem | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch initial unread count on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    fetch('/api/notifications?count_only=true', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.unreadCount !== undefined) {
          setUnreadCount(data.data.unreadCount);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // Listen for real-time notification:new events
  useEffect(() => {
    if (!notifSocket) return;

    const handler = (payload: NotificationPayload & { actor?: { display_name: string; avatar_url: string | null; avatar_color: string } }) => {
      // Increment unread count
      setUnreadCount((prev) => prev + 1);

      // Add to toast queue
      if (payload.actor) {
        const toastItem: NotificationToastItem = {
          id: payload.id,
          type: payload.type,
          actor_display_name: payload.actor.display_name,
          actor_avatar_url: payload.actor.avatar_url,
          actor_avatar_color: payload.actor.avatar_color,
          preview_text: payload.preview_text,
          entity_type: payload.entity_type,
          entity_id: payload.entity_id,
          timestamp: Date.now(),
        };
        setToastQueue((prev) => [...prev, toastItem]);
      }
    };

    notifSocket.on('notification:new', handler);
    return () => {
      notifSocket.off('notification:new', handler);
    };
  }, [notifSocket]);

  // Show next toast from queue (one at a time)
  useEffect(() => {
    if (currentToast || toastQueue.length === 0) return;

    const [next, ...rest] = toastQueue;
    setCurrentToast(next);
    setToastQueue(rest);

    // Auto-dismiss after timeout
    dismissTimerRef.current = setTimeout(() => {
      setCurrentToast(null);
    }, TOAST_AUTO_DISMISS_MS);

    return () => {
      clearTimeout(dismissTimerRef.current);
    };
  }, [currentToast, toastQueue]);

  const dismissToast = useCallback(() => {
    clearTimeout(dismissTimerRef.current);
    setCurrentToast(null);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?count_only=true', { credentials: 'include' });
      const data = await res.json();
      if (data.data?.unreadCount !== undefined) {
        setUnreadCount(data.data.unreadCount);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const decrementUnread = useCallback((amount = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - amount));
  }, []);

  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const value: NotificationContextValue = {
    unreadCount,
    toastQueue,
    currentToast,
    dismissToast,
    refreshUnreadCount,
    decrementUnread,
    clearUnreadCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Access notification context for global unread count and toast management.
 * Must be used within a NotificationProvider.
 */
export function useNotificationContext(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotificationContext must be used within a NotificationProvider. ' +
      'Ensure this component is rendered inside a layout that wraps with NotificationProvider.'
    );
  }
  return context;
}
