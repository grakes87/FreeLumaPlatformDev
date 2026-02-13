'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useChat, type ChatMessage } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { MessageContextMenu } from './MessageContextMenu';
import { TypingIndicator } from './TypingIndicator';
import type { ReactionType } from '@/lib/utils/constants';

interface Participant {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  is_verified: boolean;
}

interface ChatViewProps {
  conversationId: number;
  conversationType: 'direct' | 'group';
  participants: Participant[];
  className?: string;
}

/** Time threshold (ms) for grouping consecutive same-sender messages */
const GROUP_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Main chat container: message list with date separators, time grouping,
 * typing indicator, and message input.
 */
export function ChatView({
  conversationId,
  conversationType,
  participants,
  className,
}: ChatViewProps) {
  const { user } = useAuth();
  const {
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
  } = useChat(conversationId);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const [contextMenu, setContextMenu] = useState<{
    message: ChatMessage;
    isOwn: boolean;
  } | null>(null);

  // Build participant name map for typing indicator
  const participantNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of participants) {
      map.set(p.id, p.display_name);
    }
    return map;
  }, [participants]);

  // Scroll to bottom on initial load and new messages
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currCount = messages.length;
    prevMessageCountRef.current = currCount;

    // Scroll to bottom when new messages added at the end
    if (currCount > prevCount && prevCount > 0) {
      // Check if the newest message was added at the end
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        const isOwnMessage = lastMsg.sender_id === user?.id;
        const container = scrollContainerRef.current;
        if (container) {
          // Auto-scroll if user is near bottom or it's their own message
          const distFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;
          if (isOwnMessage || distFromBottom < 150) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    }
  }, [messages, user?.id]);

  // Initial scroll to bottom
  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, [loading, messages.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load more on scroll to top
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loadingMore || !hasMore) return;
    if (container.scrollTop < 80) {
      // Remember scroll position to maintain it after prepend
      const prevHeight = container.scrollHeight;
      loadMore().then(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop =
              scrollContainerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [loadMore, loadingMore, hasMore]);

  // Build group members list for mention picker
  const groupMembers = useMemo(() => {
    if (conversationType !== 'group') return [];
    return participants.map((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      avatar_color: p.avatar_color,
    }));
  }, [participants, conversationType]);

  // Send handler
  const handleSend = useCallback(
    (content: string, mentionedUserIds?: number[]) => {
      const options: {
        reply_to_id?: number;
        mentioned_user_ids?: number[];
      } = {};
      if (replyTo) options.reply_to_id = replyTo.id;
      if (mentionedUserIds && mentionedUserIds.length > 0) {
        options.mentioned_user_ids = mentionedUserIds;
      }
      sendMessage(content, options);
    },
    [sendMessage, replyTo]
  );

  // Context menu handlers
  const handleLongPress = useCallback(
    (message: ChatMessage) => {
      setContextMenu({
        message,
        isOwn: message.sender_id === user?.id,
      });
    },
    [user?.id]
  );

  const handleReply = useCallback(() => {
    if (contextMenu) setReplyTo(contextMenu.message);
  }, [contextMenu, setReplyTo]);

  const handleReact = useCallback(
    (type: ReactionType) => {
      if (contextMenu) reactToMessage(contextMenu.message.id, type);
    },
    [contextMenu, reactToMessage]
  );

  const handleCopy = useCallback(() => {
    if (contextMenu?.message.content) {
      navigator.clipboard.writeText(contextMenu.message.content).catch(() => {});
    }
  }, [contextMenu]);

  const handleUnsend = useCallback(() => {
    if (contextMenu) unsendMessage(contextMenu.message.id);
  }, [contextMenu, unsendMessage]);

  // Group messages by date for separators
  const groupedMessages = useMemo(() => groupByDate(messages), [messages]);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Message list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {/* Loading initial */}
        {loading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {/* No messages */}
        {!loading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Send a message to start the conversation
            </p>
          </div>
        )}

        {/* Messages grouped by date */}
        {!loading &&
          groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="sticky top-0 z-10 flex justify-center py-2">
                <span className="rounded-full bg-gray-200/80 dark:bg-gray-700/80 px-3 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 backdrop-blur-sm">
                  {group.label}
                </span>
              </div>

              {/* Messages */}
              {group.messages.map((msg, idx) => {
                const isOwnMessage = msg.sender_id === user?.id;
                const prev = idx > 0 ? group.messages[idx - 1] : null;
                const next = idx < group.messages.length - 1 ? group.messages[idx + 1] : null;

                // Show avatar only for first message in a consecutive group
                const isSameSenderAsPrev =
                  prev &&
                  prev.sender_id === msg.sender_id &&
                  !prev.is_unsent &&
                  new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() <
                    GROUP_THRESHOLD_MS;

                const isSameSenderAsNext =
                  next &&
                  next.sender_id === msg.sender_id &&
                  !msg.is_unsent &&
                  new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() <
                    GROUP_THRESHOLD_MS;

                const showAvatar = !isOwnMessage && !isSameSenderAsPrev;
                const showTime = !isSameSenderAsNext;

                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwnMessage={isOwnMessage}
                    conversationType={conversationType}
                    showAvatar={showAvatar}
                    showTime={showTime}
                    onLongPress={handleLongPress}
                  />
                );
              })}
            </div>
          ))}

        {/* Typing indicator */}
        <TypingIndicator
          typingUsers={typingUsers}
          participantNames={participantNames}
        />

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onTyping={emitTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        isGroup={conversationType === 'group'}
        groupMembers={groupMembers}
      />

      {/* Context menu */}
      <MessageContextMenu
        isOpen={!!contextMenu}
        message={contextMenu?.message ?? null}
        isOwnMessage={contextMenu?.isOwn ?? false}
        onClose={() => setContextMenu(null)}
        onReply={handleReply}
        onReact={handleReact}
        onCopy={handleCopy}
        onUnsend={handleUnsend}
      />
    </div>
  );
}

// ---- Helpers ----

interface DateGroup {
  date: string;
  label: string;
  messages: ChatMessage[];
}

function groupByDate(messages: ChatMessage[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let current: DateGroup | null = null;

  for (const msg of messages) {
    const dateStr = new Date(msg.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    if (!current || current.date !== dateStr) {
      current = {
        date: dateStr,
        label: formatDateLabel(msg.created_at),
        messages: [],
      };
      groups.push(current);
    }
    current.messages.push(msg);
  }

  return groups;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
