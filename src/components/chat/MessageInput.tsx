'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Send, Plus, Mic, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { MentionPicker, type MentionMember } from './MentionPicker';
import { MediaAttachmentSheet } from './MediaAttachmentSheet';
import { VoiceRecorder } from './VoiceRecorder';
import type { ChatMessage } from '@/hooks/useChat';

interface MessageInputProps {
  onSend: (content: string, mentionedUserIds?: number[]) => void;
  onSendMedia: (options: {
    type: 'media' | 'voice';
    media: Array<{ media_url: string; media_type: 'image' | 'video' | 'voice'; duration?: number }>;
  }) => void;
  onTyping: () => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  disabled?: boolean;
  className?: string;
  /** Group conversation members for @mention picker */
  groupMembers?: MentionMember[];
  /** Whether this is a group conversation */
  isGroup?: boolean;
  /** Conversation ID for media/voice uploads */
  conversationId: number;
}

/**
 * Chat message input with auto-expanding textarea, send button,
 * placeholder buttons for attachments (+) and voice (mic),
 * reply preview bar, and @mention picker for group conversations.
 */
export function MessageInput({
  onSend,
  onSendMedia,
  onTyping,
  replyTo,
  onCancelReply,
  disabled = false,
  className,
  groupMembers = [],
  isGroup = false,
  conversationId,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [mentionState, setMentionState] = useState<{
    active: boolean;
    query: string;
    startIndex: number;
  }>({ active: false, query: '', startIndex: -1 });
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
  const [showMediaSheet, setShowMediaSheet] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
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

  // Detect @ mentions in text
  const detectMention = useCallback(
    (value: string, cursorPos: number) => {
      if (!isGroup || groupMembers.length === 0) {
        setMentionState({ active: false, query: '', startIndex: -1 });
        return;
      }

      // Look backwards from cursor for an "@" character
      const textBefore = value.slice(0, cursorPos);
      const atIndex = textBefore.lastIndexOf('@');

      if (atIndex === -1) {
        setMentionState({ active: false, query: '', startIndex: -1 });
        return;
      }

      // Check that "@" is at start of text or preceded by whitespace
      if (atIndex > 0 && !/\s/.test(textBefore[atIndex - 1])) {
        setMentionState({ active: false, query: '', startIndex: -1 });
        return;
      }

      // Get text after "@" up to cursor
      const query = textBefore.slice(atIndex + 1);

      // If query contains spaces that don't match any member, dismiss
      if (query.length > 30) {
        setMentionState({ active: false, query: '', startIndex: -1 });
        return;
      }

      setMentionState({ active: true, query, startIndex: atIndex });
    },
    [isGroup, groupMembers.length]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setText(value);
      onTyping();
      detectMention(value, e.target.selectionStart ?? value.length);
    },
    [onTyping, detectMention]
  );

  const handleSelect = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      detectMention(text, target.selectionStart ?? text.length);
    },
    [text, detectMention]
  );

  // Handle mention selection
  const handleMentionSelect = useCallback(
    (member: MentionMember) => {
      if (mentionState.startIndex < 0) return;

      // Replace @query with @display_name
      const before = text.slice(0, mentionState.startIndex);
      const after = text.slice(mentionState.startIndex + 1 + mentionState.query.length);
      const newText = `${before}@${member.display_name} ${after}`;

      setText(newText);
      setMentionState({ active: false, query: '', startIndex: -1 });

      // Track mentioned user ID
      setMentionedUserIds((prev) =>
        prev.includes(member.id) ? prev : [...prev, member.id]
      );

      // Move cursor to after the inserted mention
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) {
          const pos = mentionState.startIndex + member.display_name.length + 2; // +2 for @ and space
          el.selectionStart = pos;
          el.selectionEnd = pos;
          el.focus();
        }
      }, 0);
    },
    [text, mentionState]
  );

  const dismissMention = useCallback(() => {
    setMentionState({ active: false, query: '', startIndex: -1 });
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, mentionedUserIds.length > 0 ? mentionedUserIds : undefined);
    setText('');
    setMentionedUserIds([]);
    setMentionState({ active: false, query: '', startIndex: -1 });
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, onSend, mentionedUserIds]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Dismiss mention picker on Escape
      if (e.key === 'Escape' && mentionState.active) {
        e.preventDefault();
        dismissMention();
        return;
      }
      // Send on Enter (desktop), Shift+Enter for newline
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, mentionState.active, dismissMention]
  );

  const hasText = text.trim().length > 0;

  return (
    <div className={cn('relative border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900', className)}>
      {/* Mention picker (above input) */}
      {isGroup && (
        <MentionPicker
          isOpen={mentionState.active}
          members={groupMembers}
          query={mentionState.query}
          onSelect={handleMentionSelect}
          onDismiss={dismissMention}
        />
      )}

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

      {/* Input row — swapped for VoiceRecorder when recording */}
      {showVoiceRecorder ? (
        <VoiceRecorder
          onSendVoice={(media) => {
            onSendMedia({ type: 'voice', media: [media] });
            setShowVoiceRecorder(false);
          }}
          onClose={() => setShowVoiceRecorder(false)}
        />
      ) : (
        <div className="flex items-end gap-1.5 px-3 py-2">
          {/* Attachment button */}
          <button
            type="button"
            onClick={() => setShowMediaSheet(true)}
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
              onSelect={handleSelect}
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
              onClick={() => setShowVoiceRecorder(true)}
              className="shrink-0 rounded-full p-2 text-gray-500 dark:text-gray-400 transition-colors hover:text-primary"
              aria-label="Record voice message"
              disabled={disabled}
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Media attachment bottom sheet */}
      <MediaAttachmentSheet
        isOpen={showMediaSheet}
        onClose={() => setShowMediaSheet(false)}
        onSendMedia={(media) => {
          onSendMedia({ type: 'media', media });
        }}
      />
    </div>
  );
}
