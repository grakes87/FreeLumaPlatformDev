'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Heart,
  MessageCircle,
  UserPlus,
  HandHelping,
  Send,
  AtSign,
  Bell,
  X,
  Play,
  Trash2,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils/cn';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { NotificationActor } from '@/lib/notifications/types';

export interface NotificationItemData {
  id: number;
  type: string;
  entity_type: string;
  entity_id: number;
  preview_text: string | null;
  is_read: boolean;
  created_at: string;
  actor?: NotificationActor;
  actor_count: number;
  recent_actors: NotificationActor[];
}

interface NotificationItemProps {
  notification: NotificationItemData;
  compact?: boolean;
  onMarkRead?: (id: number) => void;
  onDismiss?: (id: number) => void;
  onFollowBack?: (userId: number) => void;
  onAcceptRequest?: (userId: number) => void;
  onDeclineRequest?: (userId: number) => void;
}

/** Map notification type to icon component and color */
const TYPE_ICON_MAP: Record<string, { icon: typeof Heart; color: string }> = {
  reaction: { icon: Heart, color: 'bg-pink-500' },
  comment: { icon: MessageCircle, color: 'bg-blue-500' },
  follow: { icon: UserPlus, color: 'bg-green-500' },
  follow_request: { icon: UserPlus, color: 'bg-green-500' },
  prayer: { icon: HandHelping, color: 'bg-purple-500' },
  message: { icon: Send, color: 'bg-teal-500' },
  mention: { icon: AtSign, color: 'bg-orange-500' },
  group_invite: { icon: UserPlus, color: 'bg-cyan-500' },
  daily_reminder: { icon: Bell, color: 'bg-amber-500' },
  new_video: { icon: Play, color: 'bg-indigo-500' },
  content_removed: { icon: Trash2, color: 'bg-red-500' },
  warning: { icon: AlertTriangle, color: 'bg-amber-600' },
  ban: { icon: ShieldAlert, color: 'bg-red-600' },
};

/** Generate notification text from type, actor name, and actor count */
function getNotificationText(
  type: string,
  actorName: string,
  actorCount: number,
): string {
  const othersText = actorCount > 1
    ? ` and ${actorCount - 1} other${actorCount - 1 > 1 ? 's' : ''}`
    : '';

  switch (type) {
    case 'reaction':
      return `${actorName}${othersText} reacted to your post`;
    case 'comment':
      return `${actorName}${othersText} commented on your post`;
    case 'follow':
      return `${actorName}${othersText} started following you`;
    case 'follow_request':
      return `${actorName} requested to follow you`;
    case 'prayer':
      return `${actorName}${othersText} prayed for your request`;
    case 'message':
      return `${actorName} sent you a message`;
    case 'mention':
      return `${actorName} mentioned you`;
    case 'group_invite':
      return `${actorName} invited you to a group`;
    case 'daily_reminder':
      return 'Your daily content is ready';
    case 'new_video':
      return 'New video available';
    case 'content_removed':
      return 'Your content was removed';
    case 'warning':
      return 'You received a warning';
    case 'ban':
      return 'Your account has been suspended';
    default:
      return `${actorName} interacted with your content`;
  }
}

/** Navigate to the source entity */
function getNotificationHref(type: string, entityType: string, entityId: number, actorId?: number): string {
  switch (type) {
    case 'follow':
    case 'follow_request':
      return actorId ? `/profile/${actorId}` : '/notifications';
    case 'message':
      return `/chat/${entityId}`;
    case 'reaction':
    case 'comment':
    case 'mention':
      if (entityType === 'post') return `/post/${entityId}`;
      if (entityType === 'daily_content') return '/';
      return '/notifications';
    case 'prayer':
      return '/prayer-wall';
    case 'group_invite':
      return `/chat/${entityId}`;
    case 'daily_reminder':
      return '/';
    case 'new_video':
      return `/watch/${entityId}`;
    case 'content_removed':
      return '/notifications';
    case 'warning':
      return '/notifications';
    case 'ban':
      return '/banned';
    default:
      return '/notifications';
  }
}

export function NotificationItem({
  notification,
  compact = false,
  onMarkRead,
  onDismiss,
  onFollowBack,
  onAcceptRequest,
  onDeclineRequest,
}: NotificationItemProps) {
  const router = useRouter();
  const { type, actor, actor_count, is_read, created_at, entity_type, entity_id, preview_text } = notification;

  const typeConfig = TYPE_ICON_MAP[type] ?? { icon: Bell, color: 'bg-primary' };
  const IconComponent = typeConfig.icon;

  const actorName = actor?.display_name ?? 'Someone';
  const notificationText = getNotificationText(type, actorName, actor_count);

  const timeAgo = formatDistanceToNow(new Date(created_at), { addSuffix: true });

  const handleClick = () => {
    if (!is_read && onMarkRead) {
      onMarkRead(notification.id);
    }
    const href = getNotificationHref(type, entity_type, entity_id, actor?.id);
    router.push(href);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-start gap-3 px-4 cursor-pointer transition-colors',
        compact ? 'py-2.5' : 'py-3',
        !is_read && 'bg-primary/5 dark:bg-primary/10',
        'hover:bg-slate-50 dark:hover:bg-white/5'
      )}
    >
      {/* Avatar with type icon overlay */}
      <div className="relative shrink-0">
        <UserAvatar
          src={actor?.avatar_url}
          name={actorName}
          color={actor?.avatar_color ?? '#62BEBA'}
          size={compact ? 36 : 44}
        />
        {/* Type icon overlay in bottom-right */}
        <div
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-surface dark:border-surface-dark',
            typeConfig.color,
            compact ? 'h-4 w-4' : 'h-5 w-5'
          )}
        >
          <IconComponent className={cn('text-white', compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        </div>
      </div>

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <p className={cn(
          'text-text dark:text-text-dark leading-snug',
          compact ? 'text-xs' : 'text-sm',
          !is_read && 'font-medium',
        )}>
          {notificationText}
        </p>
        {preview_text && !compact && (
          <p className="mt-0.5 truncate text-xs text-text-muted dark:text-text-muted-dark">
            {preview_text}
          </p>
        )}
        <p className={cn(
          'text-text-muted dark:text-text-muted-dark mt-0.5',
          compact ? 'text-[10px]' : 'text-xs'
        )}>
          {timeAgo}
        </p>

        {/* Action buttons for follow types */}
        {!compact && type === 'follow' && onFollowBack && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); actor && onFollowBack(actor.id); }}
            className="mt-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Follow back
          </button>
        )}
        {!compact && type === 'follow_request' && onAcceptRequest && onDeclineRequest && (
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); actor && onAcceptRequest(actor.id); }}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); actor && onDeclineRequest(actor.id); }}
              className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text transition-colors hover:bg-slate-50 dark:border-border-dark dark:text-text-dark dark:hover:bg-white/5"
            >
              Decline
            </button>
          </div>
        )}
      </div>

      {/* Dismiss button (non-compact only) */}
      {!compact && onDismiss && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
          className="shrink-0 rounded-full p-1 text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Unread indicator dot (compact mode) */}
      {compact && !is_read && (
        <div className="mt-2 shrink-0">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
}
