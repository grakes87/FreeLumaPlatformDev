'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
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
  const { isAuthenticated } = useAuth();
  const chatRef = useRef<Socket | null>(null);
  const notifRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clean up any existing connections if user logs out
      if (chatRef.current) {
        chatRef.current.disconnect();
        chatRef.current = null;
      }
      if (notifRef.current) {
        notifRef.current.disconnect();
        notifRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Connect to /chat namespace
    const chatSocket = io('/chat', {
      autoConnect: true,
      withCredentials: true,
      // Reconnection settings
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    // Connect to /notifications namespace
    const notifSocket = io('/notifications', {
      autoConnect: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    chatRef.current = chatSocket;
    notifRef.current = notifSocket;

    // Track connection state via the chat socket
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    chatSocket.on('connect', onConnect);
    chatSocket.on('disconnect', onDisconnect);

    return () => {
      chatSocket.off('connect', onConnect);
      chatSocket.off('disconnect', onDisconnect);
      chatSocket.disconnect();
      notifSocket.disconnect();
      chatRef.current = null;
      notifRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated]);

  const value: SocketContextValue = {
    chatSocket: chatRef.current,
    notifSocket: notifRef.current,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Access the socket context. Must be used within a SocketProvider.
 * Returns null values when user is not authenticated (sockets not connected).
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
