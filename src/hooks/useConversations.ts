'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';

export interface ConversationParticipant {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  is_verified: boolean;
}

export interface ConversationData {
  id: number;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender: string | null;
  unread_count: number;
  participants: ConversationParticipant[];
}

export interface MessageRequestData {
  id: number;
  requester: ConversationParticipant;
  conversation_id: number;
  preview: string | null;
  created_at: string;
}

interface ConversationsResponse {
  conversations: ConversationData[];
  messageRequests: MessageRequestData[];
}

/**
 * Hook for managing the chat conversation list with real-time Socket.IO updates.
 * Fetches from GET /api/chat/conversations, listens for message:new,
 * conversation:new, conversation:deleted, and message:unsent events.
 */
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [messageRequests, setMessageRequests] = useState<MessageRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { chatSocket } = useSocket();

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversations = useCallback(async (searchQuery?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery?.trim()) {
        params.set('search', searchQuery.trim());
      }

      const url = `/api/chat/conversations${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch conversations: ${res.status}`);
      }

      const data: ConversationsResponse = await res.json();
      setConversations(data.conversations);
      setMessageRequests(data.messageRequests);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[useConversations] fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchConversations]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchConversations(search);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search, fetchConversations]);

  // Socket.IO listeners for real-time updates
  useEffect(() => {
    if (!chatSocket) return;

    const handleNewMessage = (data: {
      conversationId: number;
      message: {
        content: string | null;
        type: string;
        sender: { display_name: string };
      };
    }) => {
      setConversations((prev) => {
        const updated = prev.map((conv) => {
          if (conv.id !== data.conversationId) return conv;

          let preview: string | null = null;
          if (data.message.content) {
            preview = data.message.content.length > 40
              ? data.message.content.slice(0, 40) + '...'
              : data.message.content;
          } else if (data.message.type === 'media') {
            preview = 'Sent a photo';
          } else if (data.message.type === 'voice') {
            preview = 'Voice message';
          } else if (data.message.type === 'shared_post') {
            preview = 'Shared a post';
          }

          return {
            ...conv,
            last_message_at: new Date().toISOString(),
            last_message_preview: preview,
            last_message_sender: conv.type === 'group'
              ? data.message.sender.display_name
              : null,
            unread_count: conv.unread_count + 1,
          };
        });

        // Sort by last_message_at (most recent first)
        return [...updated].sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        });
      });
    };

    const handleNewConversation = (data: { conversation: ConversationData }) => {
      setConversations((prev) => {
        // Avoid duplicates
        if (prev.some((c) => c.id === data.conversation.id)) return prev;
        return [data.conversation, ...prev];
      });
    };

    const handleDeletedConversation = (data: { conversationId: number }) => {
      setConversations((prev) =>
        prev.filter((c) => c.id !== data.conversationId)
      );
    };

    const handleMessageUnsent = (data: { conversationId: number }) => {
      // Refresh to get the correct last message preview
      fetchConversations(search);
    };

    chatSocket.on('message:new', handleNewMessage);
    chatSocket.on('conversation:new', handleNewConversation);
    chatSocket.on('conversation:deleted', handleDeletedConversation);
    chatSocket.on('message:unsent', handleMessageUnsent);

    return () => {
      chatSocket.off('message:new', handleNewMessage);
      chatSocket.off('conversation:new', handleNewConversation);
      chatSocket.off('conversation:deleted', handleDeletedConversation);
      chatSocket.off('message:unsent', handleMessageUnsent);
    };
  }, [chatSocket, fetchConversations, search]);

  const refreshConversations = useCallback(() => {
    fetchConversations(search);
  }, [fetchConversations, search]);

  return {
    conversations,
    messageRequests,
    loading,
    error,
    search,
    setSearch,
    refreshConversations,
  };
}
