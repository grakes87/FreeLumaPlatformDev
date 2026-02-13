'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

export interface MentionMember {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface MentionPickerProps {
  isOpen: boolean;
  members: MentionMember[];
  query: string;
  onSelect: (member: MentionMember) => void;
  onDismiss: () => void;
}

/**
 * Dropdown picker for @mentions in group conversations.
 * Filters group members by display_name or username matching the text after "@".
 * Anchored above the input area.
 */
export function MentionPicker({
  isOpen,
  members,
  query,
  onSelect,
  onDismiss,
}: MentionPickerProps) {
  // Filter members by query
  const filtered = useMemo(() => {
    if (!query) return members;
    const lower = query.toLowerCase();
    return members.filter(
      (m) =>
        m.display_name.toLowerCase().includes(lower) ||
        m.username.toLowerCase().includes(lower)
    );
  }, [members, query]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <>
      {/* Backdrop for dismissal */}
      <div
        className="fixed inset-0 z-30"
        onClick={onDismiss}
        aria-hidden
      />

      {/* Picker dropdown above input */}
      <div
        className={cn(
          'absolute bottom-full left-0 right-0 z-40 mb-1 mx-3',
          'max-h-48 overflow-y-auto rounded-xl',
          'border border-gray-200 dark:border-gray-700',
          'bg-white dark:bg-gray-800 shadow-lg'
        )}
      >
        {filtered.slice(0, 8).map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => onSelect(member)}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
              'hover:bg-gray-50 dark:hover:bg-white/5'
            )}
          >
            <div className="shrink-0">
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={member.display_name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <InitialsAvatar
                  name={member.display_name}
                  color={member.avatar_color}
                  size={32}
                  className="text-[10px]"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {member.display_name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                @{member.username}
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
