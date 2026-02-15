'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MessageSquare, ArrowDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatReplayMessage {
  id: number;
  user_id: number;
  message: string;
  offset_ms: number;
  created_at: string;
  user: {
    id: number;
    display_name: string;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
  };
}

export interface ChatReplayProps {
  workshopId: number;
  /** Current video playback position in milliseconds */
  currentTimeMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format milliseconds as a "MM:SS" or "H:MM:SS" timestamp.
 */
function formatOffsetMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Time-synced chat sidebar for workshop recording playback.
 *
 * Fetches all chat messages on mount and filters visibility based on
 * the current playback position (currentTimeMs). Auto-scrolls to the
 * latest visible message unless the user has scrolled up.
 */
export function ChatReplay({ workshopId, currentTimeMs }: ChatReplayProps) {
  const [allMessages, setAllMessages] = useState<ChatReplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevVisibleCountRef = useRef(0);

  // ---- Fetch all messages on mount ----

  useEffect(() => {
    let cancelled = false;

    async function fetchMessages() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/workshops/${workshopId}/chat?limit=1000`, {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Failed to load chat history');
        }

        const json = await res.json();
        const data = json.data ?? json;

        if (!cancelled) {
          setAllMessages(data.messages ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chat');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [workshopId]);

  // ---- Filter visible messages based on playback position ----

  const visibleMessages = useMemo(
    () => allMessages.filter((msg) => msg.offset_ms <= currentTimeMs),
    [allMessages, currentTimeMs]
  );

  // ---- Scroll detection ----

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsScrolledUp(distanceFromBottom > 60);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledUp(false);
  }, []);

  // ---- Auto-scroll when new messages become visible ----

  useEffect(() => {
    const currentCount = visibleMessages.length;
    if (currentCount > prevVisibleCountRef.current && !isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevVisibleCountRef.current = currentCount;
  }, [visibleMessages.length, isScrolledUp]);

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-slate-900 text-slate-100">
        <div className="flex-shrink-0 border-b border-slate-700 px-3 py-2">
          <h3 className="text-sm font-semibold text-slate-200">Chat Replay</h3>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col bg-slate-900 text-slate-100">
        <div className="flex-shrink-0 border-b border-slate-700 px-3 py-2">
          <h3 className="text-sm font-semibold text-slate-200">Chat Replay</h3>
        </div>
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-center text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-700 px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
          <MessageSquare className="h-4 w-4" />
          Chat Replay
        </h3>
        <span className="text-xs text-slate-500">
          {visibleMessages.length}/{allMessages.length}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600"
      >
        {visibleMessages.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-500">
            {allMessages.length === 0
              ? 'No chat messages in this workshop.'
              : 'Chat messages will appear as the video plays.'}
          </p>
        )}

        {visibleMessages.map((msg) => (
          <div key={msg.id} className="group mb-1.5 rounded px-2 py-1">
            <div className="flex items-start gap-2">
              {/* Avatar */}
              {msg.user.avatar_url ? (
                <img
                  src={msg.user.avatar_url}
                  alt={msg.user.display_name}
                  className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <InitialsAvatar
                  name={msg.user.display_name}
                  color={msg.user.avatar_color || '#6366f1'}
                  size={20}
                  className="mt-0.5 flex-shrink-0 text-[8px]"
                />
              )}

              {/* Message content */}
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-400">
                    {msg.user.display_name}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {formatOffsetMs(msg.offset_ms)}
                  </span>
                </span>
                <p className="break-words text-sm leading-snug text-slate-200">
                  {msg.message}
                </p>
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-latest button */}
      {isScrolledUp && visibleMessages.length > 0 && (
        <div className="flex justify-center px-3 pb-2">
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
    </div>
  );
}
