'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BellOff, CheckCheck } from 'lucide-react';
import { NotificationItem, type NotificationItemData } from './NotificationItem';
import { useNotificationContext } from '@/context/NotificationContext';
import { useSocket } from '@/hooks/useSocket';
import type { NotificationActor, NotificationPayload } from '@/lib/notifications/types';

interface NotificationDropdownProps {
  /** Whether the dropdown is currently visible */
  isOpen: boolean;
  /** Close the dropdown */
  onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const { notifSocket } = useSocket();
  const { refreshUnreadCount, decrementUnread } = useNotificationContext();
  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch latest notifications when dropdown opens
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetch('/api/notifications?limit=10', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.notifications) {
          setNotifications(data.data.notifications);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Listen for real-time new notifications while open
  useEffect(() => {
    if (!notifSocket || !isOpen) return;

    const handler = (payload: NotificationPayload & { actor?: NotificationActor; actor_count?: number; recent_actors?: NotificationActor[] }) => {
      const item: NotificationItemData = {
        id: payload.id,
        type: payload.type,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        preview_text: payload.preview_text,
        is_read: false,
        created_at: typeof payload.created_at === 'string'
          ? payload.created_at
          : new Date(payload.created_at).toISOString(),
        actor: payload.actor,
        actor_count: payload.actor_count ?? 1,
        recent_actors: payload.recent_actors ?? (payload.actor ? [payload.actor] : []),
      };
      setNotifications((prev) => [item, ...prev].slice(0, 10));
    };

    notifSocket.on('notification:new', handler);
    return () => { notifSocket.off('notification:new', handler); };
  }, [notifSocket, isOpen]);

  const handleMarkRead = useCallback((id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    decrementUnread(1);

    fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'mark-read', notification_id: id }),
    }).catch(() => {});
  }, [decrementUnread]);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    refreshUnreadCount();

    fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'mark-all-read' }),
    }).then(() => refreshUnreadCount()).catch(() => {});
  }, [refreshUnreadCount]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute right-0 top-full mt-1 w-80 overflow-hidden rounded-2xl"
      style={{
        backdropFilter: 'blur(8px) saturate(160%)',
        WebkitBackdropFilter: 'blur(8px) saturate(160%)',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Notifications</h3>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleMarkAllRead(); }}
            className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 pb-6 pt-4">
            <BellOff className="h-8 w-8 text-white/20" />
            <p className="text-sm text-white/50">No notifications yet</p>
            <p className="text-xs text-white/30">You&apos;re all caught up!</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} onClick={onClose}>
              <NotificationItem
                notification={n}
                compact
                onMarkRead={handleMarkRead}
              />
            </div>
          ))
        )}
      </div>

      {/* Footer: See all link */}
      {notifications.length > 0 && (
        <div className="border-t border-white/10 px-4 py-2.5">
          <Link
            href="/notifications"
            onClick={onClose}
            className="block text-center text-xs font-medium text-primary hover:text-primary-light transition-colors"
          >
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
