'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BellOff, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { NotificationFilters } from '@/components/notifications/NotificationFilters';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function NotificationsPage() {
  const {
    notifications,
    loading,
    hasMore,
    filter,
    setFilter,
    loadMore,
    markRead,
    markAllRead,
    clearAll,
  } = useNotifications();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  // Follow back handler (calls follow API)
  const handleFollowBack = useCallback(async (userId: number) => {
    try {
      await fetch('/api/follows/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ target_user_id: userId }),
      });
    } catch {
      // Silently fail
    }
  }, []);

  // Accept follow request
  const handleAcceptRequest = useCallback(async (userId: number) => {
    try {
      await fetch('/api/follows/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requester_id: userId, action: 'accept' }),
      });
    } catch {
      // Silently fail
    }
  }, []);

  // Decline follow request
  const handleDeclineRequest = useCallback(async (userId: number) => {
    try {
      await fetch('/api/follows/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requester_id: userId, action: 'decline' }),
      });
    } catch {
      // Silently fail
    }
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-bold text-text dark:text-text-dark">
          Notifications
        </h1>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <>
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-slate-100 hover:text-text dark:text-text-muted-dark dark:hover:bg-white/10 dark:hover:text-text-dark"
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                title="Clear all notifications"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Clear all</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <NotificationFilters activeFilter={filter} onFilterChange={setFilter} />

      {/* Notification list */}
      <div className="divide-y divide-border/50 dark:divide-border-dark/50">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="md" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-16">
            <BellOff className="h-12 w-12 text-text-muted/30 dark:text-text-muted-dark/30" />
            <p className="text-base font-medium text-text-muted dark:text-text-muted-dark">
              No notifications yet
            </p>
            <p className="max-w-xs text-center text-sm text-text-muted/70 dark:text-text-muted-dark/70">
              Interact with the community to see activity here
            </p>
          </div>
        ) : (
          <>
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={markRead}
                onFollowBack={handleFollowBack}
                onAcceptRequest={handleAcceptRequest}
                onDeclineRequest={handleDeclineRequest}
              />
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />

            {loading && (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear confirmation dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={clearAll}
        title="Clear all notifications"
        message="This will permanently delete all your notifications. This action cannot be undone."
        confirmLabel="Clear all"
        danger
      />
    </div>
  );
}
