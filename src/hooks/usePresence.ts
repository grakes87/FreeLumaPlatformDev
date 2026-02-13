'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';

/**
 * Hook for tracking online/offline presence of users via Socket.IO.
 * Listens for presence:online and presence:offline events from the /chat namespace.
 * Exposes an isOnline(userId) function and the set of online user IDs.
 */
export function usePresence(userIds?: number[]) {
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const { chatSocket } = useSocket();
  const userIdsRef = useRef(userIds);
  userIdsRef.current = userIds;

  // Query initial presence status when userIds change
  useEffect(() => {
    if (!chatSocket || !userIds || userIds.length === 0) return;

    chatSocket.emit('presence:query', { userIds }, (response: { online: number[] }) => {
      if (response?.online) {
        setOnlineUsers(new Set(response.online));
      }
    });
  }, [chatSocket, userIds]);

  // Listen for presence events
  useEffect(() => {
    if (!chatSocket) return;

    const handleOnline = (data: { userId: number }) => {
      setOnlineUsers((prev) => {
        if (prev.has(data.userId)) return prev;
        const next = new Set(prev);
        next.add(data.userId);
        return next;
      });
    };

    const handleOffline = (data: { userId: number }) => {
      setOnlineUsers((prev) => {
        if (!prev.has(data.userId)) return prev;
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };

    chatSocket.on('presence:online', handleOnline);
    chatSocket.on('presence:offline', handleOffline);

    return () => {
      chatSocket.off('presence:online', handleOnline);
      chatSocket.off('presence:offline', handleOffline);
    };
  }, [chatSocket]);

  const isOnline = useCallback(
    (userId: number): boolean => onlineUsers.has(userId),
    [onlineUsers]
  );

  return { isOnline, onlineUsers };
}
