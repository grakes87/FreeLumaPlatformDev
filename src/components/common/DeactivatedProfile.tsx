'use client';

import { UserX } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface DeactivatedProfileProps {
  username?: string;
  className?: string;
}

/**
 * Placeholder component shown when viewing a deactivated user's profile.
 * Displays a grayed-out ghost icon with "Account deactivated" message.
 * No bio, no posts tab, no follow button.
 */
export function DeactivatedProfile({ username, className }: DeactivatedProfileProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16', className)}>
      {/* Grayed avatar placeholder */}
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
        <UserX className="h-10 w-10 text-gray-400 dark:text-gray-500" />
      </div>

      {/* Username (if available) */}
      {username && (
        <p className="mb-1 text-sm text-gray-400 dark:text-gray-500">
          @{username}
        </p>
      )}

      {/* Message */}
      <h2 className="text-lg font-semibold text-gray-500 dark:text-gray-400">
        Account Deactivated
      </h2>
      <p className="mt-1 text-center text-sm text-gray-400 dark:text-gray-500">
        This account is no longer active.
      </p>
    </div>
  );
}
