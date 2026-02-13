'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Plus, Mic, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { ChatMessage } from '@/hooks/useChat';

interface MessageInputProps {
  onSend: (content: string) => void;
  onTyping: () => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Chat message input with auto-expanding textarea, send button,
 * placeholder buttons for attachments (+) and voice (mic),
 * and reply preview bar.
 */
export function MessageInput({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  disabled = false,
  className,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // Max 4 lines (~96px)
    el.style.height = Math.min(el.scrollHeight, 96) + 'px';
  }, [text]);

  // Focus textarea when replying
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      onTyping();
    },
    [onTyping]
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Send on Enter (desktop), Shift+Enter for newline
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const hasText = text.trim().length > 0;

  return (
    <div className={cn('border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900', className)}>
      {/* Reply preview bar */}
      {replyTo && (
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-2">
          <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
            <p className="text-xs font-medium text-primary truncate">
              {replyTo.sender.display_name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {replyTo.is_unsent
                ? 'Message was unsent'
                : replyTo.content || 'Media'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Cancel reply"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-1.5 px-3 py-2">
        {/* Attachment button (placeholder for 03-09) */}
        <button
          type="button"
          className="shrink-0 rounded-full p-2 text-gray-500 dark:text-gray-400 transition-colors hover:text-primary"
          aria-label="Add attachment"
          disabled={disabled}
        >
          <Plus className="h-5 w-5" />
        </button>

        {/* Text input */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full resize-none rounded-2xl border border-gray-200 dark:border-gray-700',
              'bg-gray-50 dark:bg-gray-800 px-3.5 py-2 text-sm',
              'text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'focus:outline-none focus:ring-1 focus:ring-primary/50',
              'max-h-24',
              disabled && 'opacity-50'
            )}
          />
        </div>

        {/* Send or Mic button */}
        {hasText ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled}
            className={cn(
              'shrink-0 rounded-full bg-primary p-2 text-white transition-all',
              'active:scale-90 hover:bg-primary/90',
              disabled && 'opacity-50'
            )}
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            className="shrink-0 rounded-full p-2 text-gray-500 dark:text-gray-400 transition-colors hover:text-primary"
            aria-label="Record voice message"
            disabled={disabled}
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
