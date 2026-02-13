'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import { useNotificationContext, type NotificationToastItem } from '@/context/NotificationContext';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import Image from 'next/image';

/** Color-coded left border by notification type */
const TYPE_BORDER_COLORS: Record<string, string> = {
  reaction: 'border-l-pink-500',
  comment: 'border-l-blue-500',
  follow: 'border-l-green-500',
  follow_request: 'border-l-green-500',
  prayer: 'border-l-purple-500',
  message: 'border-l-teal-500',
  mention: 'border-l-orange-500',
  group_invite: 'border-l-cyan-500',
  daily_reminder: 'border-l-amber-500',
};

/** Get destination URL for tapping a toast */
function getToastHref(toast: NotificationToastItem): string {
  switch (toast.type) {
    case 'follow':
    case 'follow_request':
      return '/notifications';
    case 'message':
      return `/chat/${toast.entity_id}`;
    case 'reaction':
    case 'comment':
    case 'mention':
      if (toast.entity_type === 'post') return `/post/${toast.entity_id}`;
      if (toast.entity_type === 'daily_content') return '/';
      return '/notifications';
    case 'prayer':
      return '/prayer-wall';
    case 'group_invite':
      return `/chat/${toast.entity_id}`;
    case 'daily_reminder':
      return '/';
    default:
      return '/notifications';
  }
}

/** Get type label for toast text */
function getToastTypeText(type: string): string {
  switch (type) {
    case 'reaction': return 'reacted to your post';
    case 'comment': return 'commented on your post';
    case 'follow': return 'started following you';
    case 'follow_request': return 'requested to follow you';
    case 'prayer': return 'prayed for your request';
    case 'message': return 'sent you a message';
    case 'mention': return 'mentioned you';
    case 'group_invite': return 'invited you to a group';
    case 'daily_reminder': return 'Your daily content is ready';
    default: return 'notification';
  }
}

/**
 * NotificationToastManager -- renders the currently visible toast.
 * Positioned at top-16 (below TopBar), centered, max-w-sm.
 * Slides down from top with animation.
 * Tappable to navigate to source.
 * Suppresses chat message toasts when already viewing that conversation.
 */
export function NotificationToastManager() {
  const { currentToast, dismissToast } = useNotificationContext();
  const router = useRouter();
  const pathname = usePathname();

  if (!currentToast) return null;

  // Suppress chat toasts when viewing that conversation
  if (currentToast.type === 'message' && pathname?.includes(`/chat/${currentToast.entity_id}`)) {
    dismissToast();
    return null;
  }

  const borderColor = TYPE_BORDER_COLORS[currentToast.type] ?? 'border-l-primary';
  const href = getToastHref(currentToast);
  const typeText = getToastTypeText(currentToast.type);

  const handleClick = () => {
    dismissToast();
    router.push(href);
  };

  const toast = (
    <div
      onClick={handleClick}
      className={cn(
        'fixed top-16 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm',
        'animate-[slideDown_0.3s_ease-out] cursor-pointer',
        'rounded-xl border-l-4 bg-surface/95 p-3 shadow-lg backdrop-blur-md',
        'dark:bg-surface-dark/95',
        borderColor,
      )}
    >
      <div className="flex items-center gap-3">
        {/* Actor avatar */}
        {currentToast.actor_avatar_url ? (
          <Image
            src={currentToast.actor_avatar_url}
            alt={currentToast.actor_display_name}
            width={32}
            height={32}
            className="rounded-full object-cover"
            style={{ width: 32, height: 32 }}
          />
        ) : (
          <InitialsAvatar
            name={currentToast.actor_display_name}
            color={currentToast.actor_avatar_color}
            size={32}
          />
        )}

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text dark:text-text-dark truncate">
            {currentToast.actor_display_name}
          </p>
          <p className="text-xs text-text-muted dark:text-text-muted-dark truncate">
            {currentToast.preview_text ?? typeText}
          </p>
        </div>
      </div>
    </div>
  );

  // Render via portal to escape stacking context
  if (typeof document === 'undefined') return null;
  return createPortal(toast, document.body);
}
