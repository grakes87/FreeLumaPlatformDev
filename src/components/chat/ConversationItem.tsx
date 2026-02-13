'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { OnlineStatusDot } from './OnlineStatusDot';
import type { ConversationData } from '@/hooks/useConversations';

interface ConversationItemProps {
  conversation: ConversationData;
  currentUserId: number;
  isOnline: boolean;
}

/**
 * Single conversation row in the conversation list.
 * Shows avatar with online dot, name, message preview, timestamp, and unread badge.
 */
export function ConversationItem({
  conversation,
  currentUserId,
  isOnline,
}: ConversationItemProps) {
  const router = useRouter();

  // For direct conversations, show the other participant's info
  const otherParticipant = conversation.type === 'direct'
    ? conversation.participants[0]
    : null;

  const displayName = conversation.type === 'direct'
    ? otherParticipant?.display_name ?? 'Unknown'
    : conversation.name ?? 'Group Chat';

  const avatarUrl = conversation.type === 'direct'
    ? otherParticipant?.avatar_url ?? null
    : conversation.avatar_url;

  const avatarColor = otherParticipant?.avatar_color ?? '#3B82F6';

  // Format timestamp
  const timestamp = conversation.last_message_at
    ? formatRelativeTime(conversation.last_message_at)
    : null;

  // Build preview text
  let preview = conversation.last_message_preview;
  if (preview && conversation.last_message_sender) {
    preview = `${conversation.last_message_sender}: ${preview}`;
  }
  // Truncate to ~40 chars for display
  if (preview && preview.length > 40) {
    preview = preview.slice(0, 40) + '...';
  }

  const hasUnread = conversation.unread_count > 0;

  return (
    <button
      type="button"
      onClick={() => router.push(`/chat/${conversation.id}`)}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
        'hover:bg-gray-50 dark:hover:bg-white/5',
        'active:bg-gray-100 dark:active:bg-white/10'
      )}
    >
      {/* Avatar with online dot */}
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <InitialsAvatar
            name={displayName}
            color={avatarColor}
            size={56}
          />
        )}
        {conversation.type === 'direct' && (
          <OnlineStatusDot isOnline={isOnline} size="md" />
        )}
      </div>

      {/* Name + preview */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              hasUnread
                ? 'font-semibold text-gray-900 dark:text-white'
                : 'font-medium text-gray-900 dark:text-gray-100'
            )}
          >
            {displayName}
          </span>
          {timestamp && (
            <span
              className={cn(
                'shrink-0 text-xs',
                hasUnread
                  ? 'text-blue-500 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500'
              )}
            >
              {timestamp}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              hasUnread
                ? 'font-medium text-gray-700 dark:text-gray-200'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {preview || 'No messages yet'}
          </span>
          {hasUnread && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-bold text-white">
              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Format a date string to a short relative time (e.g., "2m", "1h", "Yesterday").
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;

  return formatDistanceToNowStrict(date, { addSuffix: false });
}
