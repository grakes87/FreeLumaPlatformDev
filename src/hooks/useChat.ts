'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';

// ---- Types ----

export interface MessageSender {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  is_verified: boolean;
}

export interface MessageMedia {
  id: number;
  media_url: string;
  media_type: 'image' | 'video' | 'voice';
  duration: number | null;
  sort_order: number;
}

export interface SharedPost {
  id: number;
  body: string | null;
  post_type: string;
  user_id: number;
  user: {
    id: number;
    username: string;
    display_name: string;
    avatar_url: string | null;
    avatar_color: string;
  };
  media?: Array<{
    id: number;
    url: string;
    media_type: string;
    thumbnail_url: string | null;
  }>;
}

export interface ReplyToMessage {
  id: number;
  content: string | null;
  type: string;
  sender_id: number;
  is_unsent: boolean;
  sender: { id: number; display_name: string };
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  type: 'text' | 'media' | 'voice' | 'shared_post' | 'system';
  content: string | null;
  reply_to_id: number | null;
  shared_post_id: number | null;
  is_unsent: boolean;
  flagged: boolean;
  created_at: string;
  updated_at: string;
  sender: MessageSender;
  media: MessageMedia[];
  replyTo: ReplyToMessage | null;
  sharedPost: SharedPost | null;
  reactions: Record<string, { count: number; reacted: boolean }>;
  delivery_status: 'sent' | 'delivered' | 'read';
  // Optimistic insert marker
  _optimistic?: boolean;
}

export interface TypingUser {
  userId: number;
  name: string;
}

interface SendMessageOptions {
  type?: 'text' | 'media' | 'voice' | 'shared_post';
  reply_to_id?: number | null;
  shared_post_id?: number | null;
  mentioned_user_ids?: number[];
  media?: Array<{
    media_url: string;
    media_type: 'image' | 'video' | 'voice';
    duration?: number | null;
    sort_order?: number;
  }>;
}

// ---- Hook ----

export function useChat(conversationId: number) {
  const { user } = useAuth();
  const { chatSocket } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<number, TypingUser>>(new Map());

  const cursorRef = useRef<string | null>(null);
  const typingTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const typingEmitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // ---- Initial fetch ----
  useEffect(() => {
    let cancelled = false;

    async function fetchMessages() {
      setLoading(true);
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load messages');
        const data = await res.json();
        if (cancelled) return;

        // API returns newest-first, reverse for display (oldest at top)
        const msgs = (data.messages as ChatMessage[]).reverse();
        setMessages(msgs);
        setHasMore(data.has_more);
        cursorRef.current = data.next_cursor;
      } catch (err) {
        console.error('[useChat] fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMessages();
    return () => { cancelled = true; };
  }, [conversationId]);

  // ---- Load older messages (scroll up) ----
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursorRef.current) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/messages?cursor=${cursorRef.current}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to load more messages');
      const data = await res.json();
      const older = (data.messages as ChatMessage[]).reverse();
      setMessages((prev) => [...older, ...prev]);
      setHasMore(data.has_more);
      cursorRef.current = data.next_cursor;
    } catch (err) {
      console.error('[useChat] loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore, hasMore]);

  // ---- Send message ----
  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      if (!user) return;

      const tempId = -Date.now();
      const msgType = options?.type ?? 'text';

      // Optimistic insert
      const optimistic: ChatMessage = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user.id,
        type: msgType,
        content: msgType === 'text' ? content : content || null,
        reply_to_id: options?.reply_to_id ?? null,
        shared_post_id: options?.shared_post_id ?? null,
        is_unsent: false,
        flagged: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          avatar_color: user.avatar_color,
          is_verified: false,
        },
        media: [],
        replyTo: replyTo
          ? {
              id: replyTo.id,
              content: replyTo.content,
              type: replyTo.type,
              sender_id: replyTo.sender_id,
              is_unsent: replyTo.is_unsent,
              sender: replyTo.sender,
            }
          : null,
        sharedPost: null,
        reactions: {},
        delivery_status: 'sent',
        _optimistic: true,
      };

      setMessages((prev) => [...prev, optimistic]);
      setReplyTo(null);

      // Stop typing indicator
      if (chatSocket && isTypingRef.current) {
        chatSocket.emit('typing:stop', { conversationId });
        isTypingRef.current = false;
      }

      try {
        const body: Record<string, unknown> = { content, type: msgType };
        if (options?.reply_to_id) body.reply_to_id = options.reply_to_id;
        if (options?.shared_post_id) body.shared_post_id = options.shared_post_id;
        if (options?.media) body.media = options.media;
        if (options?.mentioned_user_ids && options.mentioned_user_ids.length > 0) {
          body.mentioned_user_ids = options.mentioned_user_ids;
        }

        const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          // Remove optimistic message on error
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          return;
        }

        const serverMsg = (await res.json()) as ChatMessage;

        // Replace optimistic with server response
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...serverMsg, delivery_status: 'sent' } : m))
        );
      } catch {
        // Remove optimistic on network failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    },
    [conversationId, user, replyTo, chatSocket]
  );

  // ---- Socket.IO listeners ----
  useEffect(() => {
    if (!chatSocket || !user) return;

    // Join conversation room
    chatSocket.emit('conversation:join', { conversationId });

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.conversation_id !== conversationId) return;
      // Skip if it's our own message (we already have the optimistic/server version)
      if (msg.sender_id === user.id) return;

      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      // Mark as read since we're viewing the conversation
      chatSocket.emit('conversation:read', { conversationId });
    };

    const handleUnsent = ({ message_id }: { message_id: number; conversation_id: number }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message_id
            ? { ...m, is_unsent: true, content: null, media: [] }
            : m
        )
      );
    };

    const handleReaction = ({
      messageId,
      userId: reactUserId,
      reactionType,
    }: {
      messageId: number;
      userId: number;
      reactionType: string;
    }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = { ...m.reactions };
          // Toggle reaction from this user
          const existing = reactions[reactionType];
          if (existing) {
            reactions[reactionType] = {
              count: existing.count + 1,
              reacted: reactUserId === user.id ? true : existing.reacted,
            };
          } else {
            reactions[reactionType] = { count: 1, reacted: reactUserId === user.id };
          }
          return { ...m, reactions };
        })
      );
    };

    const handleRead = ({
      userId: readUserId,
    }: {
      userId: number;
      conversationId: number;
      readAt: string;
    }) => {
      if (readUserId === user.id) return;
      // Update all our sent messages to "read"
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_id === user.id && m.delivery_status !== 'read'
            ? { ...m, delivery_status: 'read' as const }
            : m
        )
      );
    };

    // Typing indicators
    const handleTypingStart = ({ userId: typingUserId }: { userId: number }) => {
      if (typingUserId === user.id) return;

      // Clear existing timeout for this user
      const existing = typingTimeoutsRef.current.get(typingUserId);
      if (existing) clearTimeout(existing);

      setTypingUsers((prev) => {
        const next = new Map(prev);
        // Use userId as name placeholder; the ChatView will resolve names
        next.set(typingUserId, { userId: typingUserId, name: '' });
        return next;
      });

      // Auto-clear after 4s if no stop event
      const timeout = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(typingUserId);
          return next;
        });
        typingTimeoutsRef.current.delete(typingUserId);
      }, 4000);

      typingTimeoutsRef.current.set(typingUserId, timeout);
    };

    const handleTypingStop = ({ userId: typingUserId }: { userId: number }) => {
      const existing = typingTimeoutsRef.current.get(typingUserId);
      if (existing) clearTimeout(existing);
      typingTimeoutsRef.current.delete(typingUserId);

      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(typingUserId);
        return next;
      });
    };

    chatSocket.on('message:new', handleNewMessage);
    chatSocket.on('message:unsent', handleUnsent);
    chatSocket.on('message:reaction', handleReaction);
    chatSocket.on('messages:read', handleRead);
    chatSocket.on('typing:start', handleTypingStart);
    chatSocket.on('typing:stop', handleTypingStop);

    return () => {
      chatSocket.off('message:new', handleNewMessage);
      chatSocket.off('message:unsent', handleUnsent);
      chatSocket.off('message:reaction', handleReaction);
      chatSocket.off('messages:read', handleRead);
      chatSocket.off('typing:start', handleTypingStart);
      chatSocket.off('typing:stop', handleTypingStop);
      chatSocket.emit('conversation:leave', { conversationId });

      // Clear all typing timeouts
      for (const t of typingTimeoutsRef.current.values()) clearTimeout(t);
      typingTimeoutsRef.current.clear();
    };
  }, [chatSocket, conversationId, user]);

  // ---- Typing emit ----
  const emitTyping = useCallback(() => {
    if (!chatSocket) return;

    if (!isTypingRef.current) {
      chatSocket.emit('typing:start', { conversationId });
      isTypingRef.current = true;
    }

    // Reset the stop timer
    if (typingEmitTimeoutRef.current) clearTimeout(typingEmitTimeoutRef.current);
    typingEmitTimeoutRef.current = setTimeout(() => {
      if (chatSocket && isTypingRef.current) {
        chatSocket.emit('typing:stop', { conversationId });
        isTypingRef.current = false;
      }
    }, 2000);
  }, [chatSocket, conversationId]);

  // Cleanup typing emit timeout on unmount
  useEffect(() => {
    return () => {
      if (typingEmitTimeoutRef.current) clearTimeout(typingEmitTimeoutRef.current);
    };
  }, []);

  // ---- Unsend message ----
  const unsendMessage = useCallback(
    async (messageId: number) => {
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ message_id: messageId }),
        });
        if (res.ok) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, is_unsent: true, content: null, media: [] } : m
            )
          );
        }
      } catch (err) {
        console.error('[useChat] unsend error:', err);
      }
    },
    [conversationId]
  );

  // ---- React to message ----
  const reactToMessage = useCallback(
    (messageId: number, reactionType: string) => {
      if (!chatSocket) return;
      chatSocket.emit('message:react', { messageId, conversationId, reactionType });

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = { ...m.reactions };
          const existing = reactions[reactionType];
          if (existing?.reacted) {
            // Remove reaction
            reactions[reactionType] = { count: existing.count - 1, reacted: false };
            if (reactions[reactionType].count <= 0) delete reactions[reactionType];
          } else if (existing) {
            reactions[reactionType] = { count: existing.count + 1, reacted: true };
          } else {
            reactions[reactionType] = { count: 1, reacted: true };
          }
          return { ...m, reactions };
        })
      );
    },
    [chatSocket, conversationId]
  );

  return {
    messages,
    loading,
    hasMore,
    loadingMore,
    loadMore,
    sendMessage,
    unsendMessage,
    reactToMessage,
    replyTo,
    setReplyTo,
    typingUsers,
    emitTyping,
  };
}
