'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Reply,
  Copy,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { MessageReactionPicker } from './MessageReactionPicker';
import type { ChatMessage } from '@/hooks/useChat';
import type { ReactionType } from '@/lib/utils/constants';

interface MessageContextMenuProps {
  isOpen: boolean;
  message: ChatMessage | null;
  isOwnMessage: boolean;
  onClose: () => void;
  onReply: () => void;
  onReact: (type: ReactionType) => void;
  onCopy: () => void;
  onUnsend: () => void;
}

/**
 * Full-screen overlay context menu for chat messages.
 * Shows reaction picker at top, then action options.
 * Triggered by long-press on a message bubble.
 */
export function MessageContextMenu({
  isOpen,
  message,
  isOwnMessage,
  onClose,
  onReply,
  onReact,
  onCopy,
  onUnsend,
}: MessageContextMenuProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  if (!isOpen || !message) return null;
  if (typeof document === 'undefined') return null;

  const canCopy = message.type === 'text' && message.content && !message.is_unsent;
  const canUnsend = isOwnMessage && !message.is_unsent;
  const canReact = !message.is_unsent;
  const canReply = !message.is_unsent;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Reaction picker */}
      {canReact && (
        <div className="relative z-10 mb-3">
          <MessageReactionPicker
            onSelect={(type) => handleAction(() => onReact(type))}
          />
        </div>
      )}

      {/* Action menu */}
      <div
        className={cn(
          'relative z-10 w-64 overflow-hidden rounded-2xl',
          'bg-gray-800/90 backdrop-blur-2xl border border-white/10',
          'shadow-xl'
        )}
      >
        {canReply && (
          <button
            type="button"
            onClick={() => handleAction(onReply)}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-white transition-colors active:bg-white/10"
          >
            <Reply className="h-4 w-4 text-white/60" />
            <span>Reply</span>
          </button>
        )}

        {canCopy && (
          <button
            type="button"
            onClick={() => handleAction(onCopy)}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-white transition-colors active:bg-white/10 border-t border-white/5"
          >
            <Copy className="h-4 w-4 text-white/60" />
            <span>Copy Text</span>
          </button>
        )}

        {canUnsend && (
          <button
            type="button"
            onClick={() => handleAction(onUnsend)}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400 transition-colors active:bg-white/10 border-t border-white/5"
          >
            <Trash2 className="h-4 w-4" />
            <span>Unsend</span>
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
