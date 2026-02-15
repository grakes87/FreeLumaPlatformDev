'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, ArrowDown, Crown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import type { ChatMessage } from '@/hooks/useWorkshopChat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkshopChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  /** Host user ID to highlight host messages */
  hostId?: number;
  /** Co-host user IDs */
  coHostIds?: number[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const MAX_MESSAGE_LENGTH = 1000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * In-room real-time chat sidebar for live workshops.
 * Compact Twitch/YouTube live chat style with auto-scroll and host highlighting.
 */
export function WorkshopChat({
  messages,
  onSendMessage,
  hostId,
  coHostIds = [],
}: WorkshopChatProps) {
  const [input, setInput] = useState('');
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Auto-scroll logic ----

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledUp(false);
  }, []);

  // Detect when user scrolls up
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsScrolledUp(distanceFromBottom > 60);
  }, []);

  // Auto-scroll on new messages (only if user hasn't scrolled up)
  useEffect(() => {
    if (!isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isScrolledUp]);

  // ---- Send message ----

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return;
    onSendMessage(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---- Render helpers ----

  const isHost = (userId: number) => userId === hostId;
  const isCoHost = (userId: number) => coHostIds.includes(userId);

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-200">Live Chat</h3>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600"
      >
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-500">
            No messages yet. Be the first to say something!
          </p>
        )}

        {messages.map((msg) => {
          const msgIsHost = isHost(msg.userId);
          const msgIsCoHost = isCoHost(msg.userId);

          return (
            <div
              key={msg.id}
              className={cn(
                'group mb-1.5 rounded px-2 py-1',
                msgIsHost && 'bg-amber-900/30',
                msgIsCoHost && !msgIsHost && 'bg-indigo-900/20'
              )}
            >
              <div className="flex items-start gap-2">
                {/* Avatar */}
                {msg.avatarUrl ? (
                  <img
                    src={msg.avatarUrl}
                    alt={msg.displayName}
                    className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <InitialsAvatar
                    name={msg.displayName}
                    color="#6366f1"
                    size={20}
                    className="mt-0.5 flex-shrink-0 text-[8px]"
                  />
                )}

                {/* Message content */}
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        msgIsHost
                          ? 'text-amber-400'
                          : msgIsCoHost
                            ? 'text-indigo-400'
                            : 'text-slate-400'
                      )}
                    >
                      {msg.displayName}
                    </span>

                    {/* Role badge */}
                    {msgIsHost && (
                      <Crown className="h-3 w-3 text-amber-400" />
                    )}
                    {msgIsCoHost && !msgIsHost && (
                      <span className="rounded bg-indigo-500/20 px-1 py-px text-[9px] font-medium text-indigo-400">
                        Co-host
                      </span>
                    )}

                    {/* Timestamp */}
                    <span className="text-[10px] text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
                      {formatTimestamp(msg.createdAt)}
                    </span>
                  </span>

                  <p className="break-words text-sm leading-snug text-slate-200">
                    {msg.message}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-latest button */}
      {isScrolledUp && (
        <div className="flex justify-center px-3 pb-1">
          <button
            type="button"
            onClick={scrollToBottom}
            className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-600"
          >
            <ArrowDown className="h-3 w-3" />
            Scroll to latest
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-slate-700 p-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            maxLength={MAX_MESSAGE_LENGTH}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              'flex-shrink-0 rounded-lg p-2 transition-colors',
              input.trim()
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'cursor-not-allowed bg-slate-700 text-slate-500'
            )}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Character count (show when near limit) */}
        {input.length > 900 && (
          <p
            className={cn(
              'mt-1 text-right text-[10px]',
              input.length > 980 ? 'text-red-400' : 'text-slate-500'
            )}
          >
            {input.length}/{MAX_MESSAGE_LENGTH}
          </p>
        )}
      </div>
    </div>
  );
}
