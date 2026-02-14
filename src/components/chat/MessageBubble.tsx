'use client';

import { useCallback, useRef, useState } from 'react';
import NextImage from 'next/image';
import { Check, CheckCheck, X, Play, MessageCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { SharedPostCard } from './SharedPostCard';
import { SharedVideoMessage } from './SharedVideoMessage';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { useMessageStatus } from '@/hooks/useMessageStatus';
import { REACTION_EMOJI_MAP } from '@/lib/utils/constants';
import type { ChatMessage, MessageSender, MessageMedia as MessageMediaType } from '@/hooks/useChat';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  conversationType: 'direct' | 'group';
  /** Show avatar (false when grouped with previous same-sender message) */
  showAvatar: boolean;
  /** Show timestamp (last message in a same-sender group) */
  showTime: boolean;
  onLongPress: (message: ChatMessage, bubbleRect: DOMRect) => void;
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
  const [viewerMedia, setViewerMedia] = useState<MessageMediaType | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Single tap on bubble to open context menu, passing bubble rect for positioning
  const handleBubbleTap = useCallback(() => {
    const rect = bubbleRef.current?.getBoundingClientRect();
    onLongPress(message, rect ?? new DOMRect(0, 0, 0, 0));
  }, [message, onLongPress]);

  const sender: MessageSender = message.sender;
  const timeStr = formatTime(message.created_at);

  // System message (centered, no bubble)
  if (message.type === 'system') {
    return (
      <div className="flex w-full justify-center px-4 py-2">
        <span className="rounded-full bg-gray-200/80 dark:bg-gray-700/60 px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
          {message.content}
        </span>
      </div>
    );
  }

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

        {/* Bubble — tap here for context menu (react / reply) */}
        <div
          ref={bubbleRef}
          onClick={handleBubbleTap}
          className={cn(
            'rounded-2xl text-sm leading-relaxed cursor-pointer',
            isOwnMessage
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
          )}
        >
          {/* Text content */}
          {message.type === 'text' && message.content && (
            <div className="px-3.5 py-2 whitespace-pre-wrap break-words">
              <MentionText text={message.content} isOwn={isOwnMessage} />
            </div>
          )}

          {/* Media content */}
          {message.type === 'media' && message.media.length > 0 && (
            <div className="overflow-hidden rounded-2xl">
              {message.media.map((m) =>
                m.media_type === 'video' ? (
                  <button
                    key={m.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewerMedia(m);
                    }}
                    className="relative block w-full"
                  >
                    <video
                      src={`${m.media_url}#t=0.001`}
                      className="max-h-64 w-full rounded-2xl object-cover"
                      preload="metadata"
                      playsInline
                      muted
                    />
                    {/* Play button overlay */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                        <Play className="h-5 w-5 translate-x-0.5 text-white" fill="currentColor" />
                      </div>
                    </div>
                  </button>
                ) : (
                  <button
                    key={m.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewerMedia(m);
                    }}
                    className="block w-full"
                  >
                    <NextImage
                      src={m.media_url}
                      alt="Message media"
                      width={280}
                      height={280}
                      className="max-h-64 w-full rounded-2xl object-cover"
                    />
                  </button>
                )
              )}
              {message.content && (
                <div className="px-3.5 py-2 whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              )}
            </div>
          )}

          {/* Voice message — Apple iMessage style */}
          {message.type === 'voice' && message.media.length > 0 && (
            <VoiceMessagePlayer
              src={message.media[0].media_url}
              duration={message.media[0].duration}
              isOwnMessage={isOwnMessage}
            />
          )}

          {/* Shared post */}
          {message.type === 'shared_post' && message.sharedPost && (
            <SharedPostCard post={message.sharedPost} className="m-1" />
          )}

          {/* Shared video */}
          {message.type === 'shared_video' && message.sharedVideo && (
            <SharedVideoMessage video={message.sharedVideo} className="m-1" />
          )}
        </div>

        {/* React · Reply link for media/voice (since tapping media opens viewer, not context menu) */}
        {(message.type === 'media' || message.type === 'voice' || message.type === 'shared_video') && (
          <button
            type="button"
            onClick={handleBubbleTap}
            className={cn(
              'mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 transition-colors hover:text-primary',
              isOwnMessage ? 'ml-auto' : ''
            )}
          >
            <MessageCircle className="h-3 w-3" />
            <span>React · Reply</span>
          </button>
        )}

        {/* Media viewer portal */}
        {viewerMedia && (
          <MediaViewer media={viewerMedia} onClose={() => setViewerMedia(null)} />
        )}

        {/* Reactions below bubble */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
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
        <NextImage
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

/**
 * Renders text with @mentions highlighted.
 * Pattern: @SomeName at start or after whitespace, terminated by end-of-string or whitespace.
 */
function MentionText({ text, isOwn }: { text: string; isOwn: boolean }) {
  // Split on @mention pattern
  const parts = text.split(/(@\S+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@') && part.length > 1) {
          return (
            <span
              key={i}
              className={cn(
                'font-semibold',
                isOwn ? 'text-white/90' : 'text-primary'
              )}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Fullscreen media viewer overlay */
function MediaViewer({
  media,
  onClose,
}: {
  media: MessageMediaType;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Media */}
      {media.media_type === 'video' ? (
        <video
          src={media.media_url}
          controls
          autoPlay
          playsInline
          className="max-h-[90vh] max-w-[95vw] rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.media_url}
          alt="Media"
          className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>,
    document.body
  );
}

// ---- Helpers ----

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

