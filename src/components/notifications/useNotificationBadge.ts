'use client';

import { useContext } from 'react';
import { NotificationContext } from '@/context/NotificationContext';

/**
 * Safe hook to get the notification unread count.
 * Returns 0 when rendered outside NotificationProvider (e.g., guest daily view).
 * This avoids the throw from useNotificationContext for guest users.
 */
export function useNotificationBadge(): number {
  const context = useContext(NotificationContext);
  return context?.unreadCount ?? 0;
}
