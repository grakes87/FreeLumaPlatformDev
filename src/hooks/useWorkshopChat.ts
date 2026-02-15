'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  message: string;
  offsetMs: number;
  createdAt: string;
}

export interface UseWorkshopChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Workshop in-room chat hook.
 * Listens for chat messages on the workshop socket and provides a send function.
 *
 * Messages are received via server echo (not optimistic) to ensure
 * consistency with the persisted chat and offset_ms calculation.
 */
export function useWorkshopChat(
  socket: Socket | null,
  workshopId: number | null
): UseWorkshopChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!socket) {
      setMessages([]);
      return;
    }

    function handleChatMessage(data: ChatMessage) {
      setMessages((prev) => [...prev, data]);
    }

    socket.on('workshop:chat-message', handleChatMessage);

    return () => {
      socket.off('workshop:chat-message', handleChatMessage);
    };
  }, [socket]);

  // Reset messages when workshop changes
  useEffect(() => {
    setMessages([]);
  }, [workshopId]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!socket || !workshopId) return;
      const trimmed = text.trim();
      if (trimmed.length === 0 || trimmed.length > 1000) return;
      socket.emit('workshop:chat', { workshopId, message: trimmed });
    },
    [socket, workshopId]
  );

  return { messages, sendMessage };
}
