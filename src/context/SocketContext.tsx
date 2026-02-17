'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';

export interface SocketContextValue {
  /** Socket connected to the /chat namespace */
  chatSocket: Socket | null;
  /** Socket connected to the /notifications namespace */
  notifSocket: Socket | null;
  /** True when the chat socket has an active connection */
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authToken } = useAuth();
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);
  const [notifSocket, setNotifSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setChatSocket((prev) => { prev?.disconnect(); return null; });
      setNotifSocket((prev) => { prev?.disconnect(); return null; });
      setIsConnected(false);
      return;
    }

    let cancelled = false;
    let chat: Socket | null = null;
    let notif: Socket | null = null;

    async function initAndConnect() {
      // Trigger server-side Socket.IO namespace setup (auth + handlers)
      try {
        await fetch('/api/socket-init');
      } catch {
        // Non-fatal: namespaces may already be set up
      }

      if (cancelled) return;

      // Socket.IO options — pass auth token for authentication fallback
      // (primary auth is via cookie, but token is a reliable fallback)
      const socketOpts = {
        autoConnect: true,
        withCredentials: true,
        transports: ['websocket'] as ('websocket')[],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        ...(authToken ? { auth: { token: authToken } } : {}),
      };

      // Connect to /chat namespace
      chat = io('/chat', socketOpts);

      // Connect to /notifications namespace
      notif = io('/notifications', socketOpts);

      if (cancelled) {
        chat.disconnect();
        notif.disconnect();
        return;
      }

      setChatSocket(chat);
      setNotifSocket(notif);

      // Track connection state via the chat socket
      chat.on('connect', () => {
        console.log('[Socket] chat connected, id:', chat?.id);
        setIsConnected(true);
      });
      chat.on('disconnect', (reason) => {
        console.log('[Socket] chat disconnected, reason:', reason);
        setIsConnected(false);
      });
      chat.on('connect_error', (err) => {
        console.error('[Socket] chat connect_error:', err.message);
      });
    }

    initAndConnect();

    return () => {
      cancelled = true;
      if (chat) {
        chat.off('connect');
        chat.off('disconnect');
        chat.disconnect();
      }
      if (notif) {
        notif.disconnect();
      }
      setChatSocket(null);
      setNotifSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, authToken]);

  const value = useMemo<SocketContextValue>(
    () => ({ chatSocket, notifSocket, isConnected }),
    [chatSocket, notifSocket, isConnected]
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Access the socket context. Must be used within a SocketProvider.
 */
export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error(
      'useSocket must be used within a SocketProvider. ' +
      'Ensure this component is rendered inside a layout that wraps with SocketProvider.'
    );
  }
  return context;
}
