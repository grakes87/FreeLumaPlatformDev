'use client';

import { useState } from 'react';
import { UserPlus, UserCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useFollow, type FollowStatus } from '@/hooks/useFollow';

interface FollowButtonProps {
  userId: number;
  initialStatus: FollowStatus;
  /** Compact size for inline usage */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Follow/unfollow button with optimistic updates.
 *
 * States:
 * - 'active' (following): outline style "Following" - hover shows "Unfollow"
 * - 'pending': outline style "Requested"
 * - 'none': filled primary "Follow"
 *
 * Unfollow/cancel shows confirmation on first click.
 */
export function FollowButton({
  userId,
  initialStatus,
  size = 'md',
  className,
}: FollowButtonProps) {
  const { status, loading, toggleFollow } = useFollow({ userId, initialStatus });
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);

  const handleClick = async () => {
    if (status === 'active' || status === 'pending') {
      if (!confirmUnfollow) {
        setConfirmUnfollow(true);
        // Auto-reset after 3 seconds
        setTimeout(() => setConfirmUnfollow(false), 3000);
        return;
      }
      setConfirmUnfollow(false);
    }
    await toggleFollow();
  };

  const sizeStyles = size === 'sm'
    ? 'px-3 py-1 text-xs gap-1'
    : 'px-4 py-1.5 text-sm gap-1.5';

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  // Confirm unfollow state
  if (confirmUnfollow) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'inline-flex shrink-0 items-center rounded-xl font-medium transition-colors',
          'border border-red-300 bg-red-50 text-red-600',
          'hover:bg-red-100',
          'dark:border-red-800 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900',
          sizeStyles,
          loading && 'pointer-events-none opacity-60',
          className
        )}
      >
        {status === 'pending' ? 'Cancel request?' : 'Unfollow?'}
      </button>
    );
  }

  if (status === 'active') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'inline-flex shrink-0 items-center rounded-xl font-medium transition-colors',
          'border border-border bg-transparent text-text',
          'hover:border-red-300 hover:bg-red-50 hover:text-red-600',
          'dark:border-border-dark dark:text-text-dark',
          'dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-400',
          sizeStyles,
          loading && 'pointer-events-none opacity-60',
          className
        )}
      >
        <UserCheck className={iconSize} />
        Following
      </button>
    );
  }

  if (status === 'pending') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'inline-flex shrink-0 items-center rounded-xl font-medium transition-colors',
          'border border-border bg-transparent text-text-muted',
          'hover:border-red-300 hover:bg-red-50 hover:text-red-600',
          'dark:border-border-dark dark:text-text-muted-dark',
          'dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-400',
          sizeStyles,
          loading && 'pointer-events-none opacity-60',
          className
        )}
      >
        <Clock className={iconSize} />
        Requested
      </button>
    );
  }

  // status === 'none'
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'inline-flex shrink-0 items-center rounded-xl font-medium transition-colors',
        'bg-primary text-white hover:bg-primary-dark',
        sizeStyles,
        loading && 'pointer-events-none opacity-60',
        className
      )}
    >
      <UserPlus className={iconSize} />
      Follow
    </button>
  );
}
