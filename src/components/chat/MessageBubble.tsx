'use client';

import { useRef, useCallback } from 'react';
import Image from 'next/image';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { SharedPostCard } from './SharedPostCard';
import { useMessageStatus } from '@/hooks/useMessageStatus';
import { REACTION_EMOJI_MAP } from '@/lib/utils/constants';
import type { ChatMessage, MessageSender } from '@/hooks/useChat';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  conversationType: 'direct' | 'group';
  /** Show avatar (false when grouped with previous same-sender message) */
  showAvatar: boolean;
  /** Show timestamp (last message in a same-sender group) */
  showTime: boolean;
  onLongPress: (message: ChatMessage) => void;
  onSwipeRight?: (message: ChatMessage) => void;
}

/**
 * Instagram DM-style message bubble.
 * Own messages: right-aligned, blue bg.
 * Other's messages: left-aligned with avatar, gray bg.
 */
export function MessageBubble({
  message,
  isOwnMessage,
  conversationType,
  showAvatar,
  showTime,
  onLongPress,
}: MessageBubbleProps) {
  const status = useMessageStatus(message, isOwnMessage, conversationType);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      longPressTimerRef.current = setTimeout(() => {
        onLongPress(message);
      }, 500);
    },
    [message, onLongPress]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    if (dx > 10 || dy > 10) {
      // Cancel long press if user scrolls/swipes
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
  }, []);

  // Context menu on desktop (right click)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onLongPress(message);
    },
    [message, onLongPress]
  );

  const sender: MessageSender = message.sender;
  const timeStr = formatTime(message.created_at);

  // Unsent message
  if (message.is_unsent) {
    return (
      <div
        className={cn(
          'flex w-full px-4 py-0.5',
          isOwnMessage ? 'justify-end' : 'justify-start'
        )}
      >
        {!isOwnMessage && showAvatar && <AvatarSlot sender={sender} />}
        {!isOwnMessage && !showAvatar && <div className="w-8 shrink-0" />}
        <div className="max-w-[75%]">
          <div
            className={cn(
              'rounded-2xl px-3.5 py-2 text-sm italic',
              isOwnMessage
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            )}
          >
            This message was unsent
          </div>
          {showTime && <TimeLabel time={timeStr} isOwn={isOwnMessage} />}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full px-4 py-0.5',
        isOwnMessage ? 'justify-end' : 'justify-start'
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Other's avatar */}
      {!isOwnMessage && showAvatar && <AvatarSlot sender={sender} />}
      {!isOwnMessage && !showAvatar && <div className="w-8 shrink-0" />}

      <div className={cn('max-w-[75%]', isOwnMessage && 'ml-auto')}>
        {/* Group: show sender name */}
        {!isOwnMessage && conversationType === 'group' && showAvatar && (
          <p className="mb-0.5 ml-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {sender.display_name}
          </p>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <ReplyPreview replyTo={message.replyTo} isOwn={isOwnMessage} />
        )}

        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl text-sm leading-relaxed',
            isOwnMessage
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
          )}
        >
          {/* Text content */}
          {message.type === 'text' && message.content && (
            <div className="px-3.5 py-2 whitespace-pre-wrap break-words">
              {message.content}
            </div>
          )}

          {/* Media content */}
          {message.type === 'media' && message.media.length > 0 && (
            <div className="overflow-hidden rounded-2xl">
              {message.media.map((m) =>
                m.media_type === 'video' ? (
                  <video
                    key={m.id}
                    src={m.media_url}
                    controls
                    className="max-h-64 w-full rounded-2xl"
                    preload="metadata"
                  />
                ) : (
                  <Image
                    key={m.id}
                    src={m.media_url}
                    alt="Message media"
                    width={280}
                    height={280}
                    className="max-h-64 w-full rounded-2xl object-cover"
                  />
                )
              )}
              {message.content && (
                <div className="px-3.5 py-2 whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              )}
            </div>
          )}

          {/* Voice message */}
          {message.type === 'voice' && message.media.length > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2">
              <audio
                src={message.media[0].media_url}
                controls
                className="h-8 w-full max-w-[200px]"
                preload="metadata"
              />
              {message.media[0].duration && (
                <span className="text-xs opacity-70">
                  {formatDuration(message.media[0].duration)}
                </span>
              )}
            </div>
          )}

          {/* Shared post */}
          {message.type === 'shared_post' && message.sharedPost && (
            <SharedPostCard post={message.sharedPost} className="m-1" />
          )}
        </div>

        {/* Reactions below bubble */}
        {Object.keys(message.reactions).length > 0 && (
          <div
            className={cn(
              'flex flex-wrap gap-1 mt-0.5',
              isOwnMessage ? 'justify-end' : 'justify-start'
            )}
          >
            {Object.entries(message.reactions).map(([type, { count, reacted }]) => (
              <span
                key={type}
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs',
                  reacted
                    ? 'bg-primary/20 border border-primary/30'
                    : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                )}
              >
                <span className="text-xs">
                  {REACTION_EMOJI_MAP[type as keyof typeof REACTION_EMOJI_MAP] || type}
                </span>
                {count > 1 && (
                  <span className="text-[10px] text-gray-600 dark:text-gray-400">
                    {count}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Time + status */}
        {showTime && (
          <div
            className={cn(
              'flex items-center gap-1 mt-0.5',
              isOwnMessage ? 'justify-end' : 'justify-start'
            )}
          >
            <TimeLabel time={timeStr} isOwn={isOwnMessage} />
            {status && <StatusIcon status={status} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Sub-components ----

function AvatarSlot({ sender }: { sender: MessageSender }) {
  return (
    <div className="mr-2 shrink-0 self-end">
      {sender.avatar_url ? (
        <Image
          src={sender.avatar_url}
          alt={sender.display_name}
          width={28}
          height={28}
          className="h-7 w-7 rounded-full object-cover"
        />
      ) : (
        <InitialsAvatar
          name={sender.display_name}
          color={sender.avatar_color}
          size={28}
          className="text-[10px]"
        />
      )}
    </div>
  );
}

function ReplyPreview({
  replyTo,
  isOwn,
}: {
  replyTo: ChatMessage['replyTo'];
  isOwn: boolean;
}) {
  if (!replyTo) return null;

  const content = replyTo.is_unsent
    ? 'Message was unsent'
    : replyTo.content
      ? replyTo.content.length > 60
        ? replyTo.content.slice(0, 60) + '...'
        : replyTo.content
      : 'Media';

  return (
    <div
      className={cn(
        'mb-0.5 rounded-xl px-3 py-1.5 text-xs',
        isOwn
          ? 'bg-primary/50 border-l-2 border-white/40'
          : 'bg-gray-200/60 dark:bg-gray-700/60 border-l-2 border-gray-400 dark:border-gray-500'
      )}
    >
      <p className={cn('font-medium', isOwn ? 'text-white/80' : 'text-gray-700 dark:text-gray-300')}>
        {replyTo.sender.display_name}
      </p>
      <p className={cn('truncate', isOwn ? 'text-white/60' : 'text-gray-500 dark:text-gray-400')}>
        {content}
      </p>
    </div>
  );
}

function TimeLabel({ time, isOwn }: { time: string; isOwn: boolean }) {
  return (
    <span
      className={cn(
        'text-[10px]',
        isOwn
          ? 'text-gray-400 dark:text-gray-500 mr-1'
          : 'text-gray-400 dark:text-gray-500 ml-1'
      )}
    >
      {time}
    </span>
  );
}

function StatusIcon({ status }: { status: 'sent' | 'delivered' | 'read' }) {
  if (status === 'sent') {
    return <Check className="h-3 w-3 text-gray-400" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="h-3 w-3 text-gray-400" />;
  }
  // read
  return <CheckCheck className="h-3 w-3 text-primary" />;
}

// ---- Helpers ----

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
