'use client';

import { cn } from '@/lib/utils/cn';
import type { TypingUser } from '@/hooks/useChat';

interface TypingIndicatorProps {
  typingUsers: Map<number, TypingUser>;
  /** Map of userId -> display_name for name resolution */
  participantNames: Map<number, string>;
  className?: string;
}

/**
 * Animated typing indicator shown when other users are typing.
 * Displays "Sarah is typing..." for 1:1 or "Sarah, John are typing..." for groups.
 */
export function TypingIndicator({
  typingUsers,
  participantNames,
  className,
}: TypingIndicatorProps) {
  if (typingUsers.size === 0) return null;

  const names = Array.from(typingUsers.keys())
    .map((uid) => participantNames.get(uid) || 'Someone')
    .slice(0, 3);

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className={cn('flex items-center gap-2 px-4 py-1.5', className)}>
      {/* Animated dots */}
      <div className="flex items-center gap-0.5" aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-[typingBounce_1.4s_ease-in-out_infinite]" />
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-[typingBounce_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-[typingBounce_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}
