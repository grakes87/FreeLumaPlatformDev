'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import NextImage from 'next/image';
import {
  Reply,
  Copy,
  Trash2,
  Play,
  Mic,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { MessageReactionPicker } from './MessageReactionPicker';
import type { ChatMessage } from '@/hooks/useChat';
import type { ReactionType } from '@/lib/utils/constants';

interface MessageContextMenuProps {
  isOpen: boolean;
  message: ChatMessage | null;
  isOwnMessage: boolean;
  /** Bounding rect of the tapped bubble, used for positioning */
  bubbleRect: DOMRect | null;
  onClose: () => void;
  onReply: () => void;
  onReact: (type: ReactionType) => void;
  onCopy: () => void;
  onUnsend: () => void;
}

/** Height estimates for positioning calculations */
const REACTION_PICKER_HEIGHT = 52;
const MENU_ITEM_HEIGHT = 44;
const GAP = 8;
const EDGE_PADDING = 12;

/**
 * iMessage-style context menu: reaction picker above, message bubble in place,
 * action menu below. Everything anchored to the original bubble position.
 */
export function MessageContextMenu({
  isOpen,
  message,
  isOwnMessage,
  bubbleRect,
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

  const canCopy = message?.type === 'text' && message.content && !message.is_unsent;
  const canUnsend = isOwnMessage && message && !message.is_unsent;
  const canReact = message && !message?.is_unsent;
  const canReply = message && !message?.is_unsent;

  const menuItemCount = useMemo(() => {
    let count = 0;
    if (canReply) count++;
    if (canCopy) count++;
    if (canUnsend) count++;
    return count;
  }, [canReply, canCopy, canUnsend]);

  // Calculate positions: reactions above bubble, bubble in place, menu below
  const positions = useMemo(() => {
    if (!bubbleRect) {
      return { reactionStyle: {}, bubbleStyle: {}, menuStyle: {} };
    }

    const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const menuWidth = 220;

    // Horizontal: align menu to the bubble's side
    let menuLeft: number;
    if (isOwnMessage) {
      menuLeft = Math.min(bubbleRect.right - menuWidth, vw - menuWidth - EDGE_PADDING);
    } else {
      menuLeft = Math.max(bubbleRect.left, EDGE_PADDING);
    }
    menuLeft = Math.max(EDGE_PADDING, Math.min(menuLeft, vw - menuWidth - EDGE_PADDING));

    // Total heights needed
    const menuHeight = menuItemCount * MENU_ITEM_HEIGHT;
    const bubbleHeight = bubbleRect.height;
    const totalNeeded = REACTION_PICKER_HEIGHT + GAP + bubbleHeight + GAP + menuHeight;

    // Try to keep bubble at its original position
    let bubbleTop = bubbleRect.top;
    let reactionTop = bubbleTop - REACTION_PICKER_HEIGHT - GAP;
    let menuTop = bubbleTop + bubbleHeight + GAP;

    // If doesn't fit, shift everything so it fits in viewport
    if (reactionTop < EDGE_PADDING) {
      // Not enough room above — push everything down
      reactionTop = EDGE_PADDING;
      bubbleTop = reactionTop + REACTION_PICKER_HEIGHT + GAP;
      menuTop = bubbleTop + bubbleHeight + GAP;
    }
    if (menuTop + menuHeight > vh - EDGE_PADDING) {
      // Not enough room below — push everything up
      menuTop = vh - EDGE_PADDING - menuHeight;
      bubbleTop = menuTop - GAP - bubbleHeight;
      reactionTop = bubbleTop - GAP - REACTION_PICKER_HEIGHT;
      // If still doesn't fit, just clamp to top
      if (reactionTop < EDGE_PADDING) {
        reactionTop = EDGE_PADDING;
        bubbleTop = reactionTop + REACTION_PICKER_HEIGHT + GAP;
        menuTop = bubbleTop + bubbleHeight + GAP;
      }
    }

    // If the whole thing is taller than viewport, scale down bubble position
    if (totalNeeded > vh - EDGE_PADDING * 2) {
      reactionTop = EDGE_PADDING;
      bubbleTop = reactionTop + REACTION_PICKER_HEIGHT + GAP;
      menuTop = vh - EDGE_PADDING - menuHeight;
    }

    const reactionStyle: React.CSSProperties = {
      position: 'fixed',
      top: reactionTop,
      left: menuLeft,
    };

    const bubbleStyle: React.CSSProperties = {
      position: 'fixed',
      top: bubbleTop,
      left: bubbleRect.left,
      width: bubbleRect.width,
      maxHeight: Math.min(bubbleHeight, menuTop - bubbleTop - GAP),
    };

    const menuStyle: React.CSSProperties = {
      position: 'fixed',
      top: menuTop,
      left: menuLeft,
      width: menuWidth,
    };

    return { reactionStyle, bubbleStyle, menuStyle };
  }, [bubbleRect, isOwnMessage, menuItemCount]);

  if (!isOpen || !message) return null;
  if (typeof document === 'undefined') return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Reaction picker — above the bubble */}
      {canReact && (
        <div style={positions.reactionStyle} className="z-10">
          <MessageReactionPicker
            onSelect={(type) => handleAction(() => onReact(type))}
          />
        </div>
      )}

      {/* Ghost bubble — shows the message in its original position */}
      {bubbleRect && (
        <div
          style={positions.bubbleStyle}
          className={cn(
            'z-10 overflow-hidden rounded-2xl text-sm leading-relaxed',
            isOwnMessage
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
          )}
        >
          <BubblePreview message={message} isOwnMessage={isOwnMessage} />
        </div>
      )}

      {/* Action menu — below the bubble */}
      <div
        style={positions.menuStyle}
        className={cn(
          'z-10 overflow-hidden rounded-2xl',
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

// ---- Ghost bubble content preview ----

function BubblePreview({
  message,
  isOwnMessage,
}: {
  message: ChatMessage;
  isOwnMessage: boolean;
}) {
  // Text
  if (message.type === 'text' && message.content) {
    return (
      <div className="px-3.5 py-2 whitespace-pre-wrap break-words">
        {message.content}
      </div>
    );
  }

  // Media
  if (message.type === 'media' && message.media.length > 0) {
    const first = message.media[0];
    return (
      <div className="overflow-hidden">
        {first.media_type === 'video' ? (
          <div className="relative">
            <video
              src={`${first.media_url}#t=0.001`}
              className="max-h-48 w-full object-cover"
              preload="metadata"
              playsInline
              muted
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
                <Play className="h-4 w-4 translate-x-0.5 text-white" fill="currentColor" />
              </div>
            </div>
          </div>
        ) : (
          <NextImage
            src={first.media_url}
            alt="Media"
            width={280}
            height={200}
            className="max-h-48 w-full object-cover"
          />
        )}
        {message.media.length > 1 && (
          <div className={cn(
            'px-3 py-1 text-xs',
            isOwnMessage ? 'text-white/70' : 'text-gray-500'
          )}>
            +{message.media.length - 1} more
          </div>
        )}
        {message.content && (
          <div className="px-3.5 py-1.5 text-xs whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}
      </div>
    );
  }

  // Voice
  if (message.type === 'voice') {
    const dur = message.media[0]?.duration;
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <Mic className={cn('h-4 w-4 shrink-0', isOwnMessage ? 'text-white/70' : 'text-gray-500')} />
        <div className="flex items-center gap-[1.5px] flex-1 h-5">
          {Array.from({ length: 16 }).map((_, i) => {
            const h = 4 + Math.sin(i * 0.8) * 6 + Math.cos(i * 1.3) * 4;
            return (
              <div
                key={i}
                className={cn(
                  'w-[2px] rounded-full',
                  isOwnMessage ? 'bg-white/50' : 'bg-gray-400 dark:bg-gray-500'
                )}
                style={{ height: `${Math.max(3, h)}px` }}
              />
            );
          })}
        </div>
        {dur != null && (
          <span className={cn(
            'text-xs font-mono tabular-nums shrink-0',
            isOwnMessage ? 'text-white/70' : 'text-gray-500'
          )}>
            {Math.floor(dur / 60)}:{String(Math.floor(dur % 60)).padStart(2, '0')}
          </span>
        )}
      </div>
    );
  }

  // Shared post
  if (message.type === 'shared_post') {
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <Share2 className={cn('h-4 w-4 shrink-0', isOwnMessage ? 'text-white/70' : 'text-gray-500')} />
        <span className={cn('text-xs', isOwnMessage ? 'text-white/80' : 'text-gray-600 dark:text-gray-300')}>
          Shared post
        </span>
      </div>
    );
  }

  // Fallback
  return (
    <div className="px-3.5 py-2 text-xs opacity-60">
      {message.content || 'Message'}
    </div>
  );
}
