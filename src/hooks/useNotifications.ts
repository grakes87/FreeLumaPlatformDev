'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useNotificationContext } from '@/context/NotificationContext';
import type { NotificationActor, NotificationPayload } from '@/lib/notifications/types';

export type NotificationFilter = 'all' | 'follows' | 'reactions' | 'comments' | 'prayer';

export interface GroupedNotification {
  id: number;
  recipient_id: number;
  actor_id: number;
  type: string;
  entity_type: string;
  entity_id: number;
  preview_text: string | null;
  group_key: string | null;
  is_read: boolean;
  created_at: string;
  actor?: NotificationActor;
  actor_count: number;
  recent_actors: NotificationActor[];
}

interface UseNotificationsReturn {
  notifications: GroupedNotification[];
  loading: boolean;
  hasMore: boolean;
  filter: NotificationFilter;
  unreadCount: number;
  setFilter: (filter: NotificationFilter) => void;
  loadMore: () => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const { notifSocket } = useSocket();
  const { unreadCount, refreshUnreadCount, decrementUnread, clearUnreadCount } = useNotificationContext();

  const [notifications, setNotifications] = useState<GroupedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilterState] = useState<NotificationFilter>('all');
  const cursorRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (
    filterVal: NotificationFilter,
    cursor?: string | null,
    append = false,
  ) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (!append) setLoading(true);

      const params = new URLSearchParams({ filter: filterVal, limit: '20' });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/notifications?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      const result = data.data as {
        notifications: GroupedNotification[];
        nextCursor: string | null;
        unreadCount: number;
      };

      if (append) {
        setNotifications((prev) => [...prev, ...result.notifications]);
      } else {
        setNotifications(result.notifications);
      }

      cursorRef.current = result.nextCursor;
      setHasMore(!!result.nextCursor);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Initial fetch and refetch on filter change
  useEffect(() => {
    cursorRef.current = null;
    fetchNotifications(filter);
  }, [filter, fetchNotifications]);

  // Load more (pagination)
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    fetchNotifications(filter, cursorRef.current, true);
  }, [hasMore, loading, filter, fetchNotifications]);

  // Set filter and reset
  const setFilter = useCallback((newFilter: NotificationFilter) => {
    setFilterState(newFilter);
  }, []);

  // Listen for real-time new notifications
  useEffect(() => {
    if (!notifSocket) return;

    const handler = (payload: NotificationPayload & { actor?: NotificationActor; actor_count?: number; recent_actors?: NotificationActor[] }) => {
      const grouped: GroupedNotification = {
        id: payload.id,
        recipient_id: payload.recipient_id,
        actor_id: payload.actor_id,
        type: payload.type,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        preview_text: payload.preview_text,
        group_key: payload.group_key,
        is_read: false,
        created_at: typeof payload.created_at === 'string'
          ? payload.created_at
          : new Date(payload.created_at).toISOString(),
        actor: payload.actor,
        actor_count: payload.actor_count ?? 1,
        recent_actors: payload.recent_actors ?? (payload.actor ? [payload.actor] : []),
      };

      setNotifications((prev) => [grouped, ...prev]);
    };

    notifSocket.on('notification:new', handler);
    return () => {
      notifSocket.off('notification:new', handler);
    };
  }, [notifSocket]);

  // Mark single notification as read
  const markRead = useCallback(async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    decrementUnread(1);

    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark-read', notification_id: id }),
      });
    } catch {
      // Revert on failure
      await refreshUnreadCount();
    }
  }, [decrementUnread, refreshUnreadCount]);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true }))
    );
    clearUnreadCount();

    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
    } catch {
      await refreshUnreadCount();
    }
  }, [clearUnreadCount, refreshUnreadCount]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    const previousNotifications = notifications;
    setNotifications([]);
    clearUnreadCount();

    try {
      await fetch('/api/notifications/clear', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      // Revert on failure
      setNotifications(previousNotifications);
      await refreshUnreadCount();
    }
  }, [notifications, clearUnreadCount, refreshUnreadCount]);

  return {
    notifications,
    loading,
    hasMore,
    filter,
    unreadCount,
    setFilter,
    loadMore,
    markRead,
    markAllRead,
    clearAll,
  };
}
