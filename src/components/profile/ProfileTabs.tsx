'use client';

import { Grid3X3, Repeat2, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type ProfileTab = 'posts' | 'reposts' | 'saved';

interface ProfileTabsProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  isOwnProfile: boolean;
  className?: string;
}

const TABS: Array<{
  key: ProfileTab;
  label: string;
  icon: typeof Grid3X3;
  ownOnly?: boolean;
}> = [
  { key: 'posts', label: 'Posts', icon: Grid3X3 },
  { key: 'reposts', label: 'Reposts', icon: Repeat2 },
  { key: 'saved', label: 'Saved', icon: Bookmark, ownOnly: true },
];

/**
 * Profile tabs: Posts, Reposts, Saved (Saved only on own profile).
 * Active tab has an underline indicator.
 */
export function ProfileTabs({
  activeTab,
  onTabChange,
  isOwnProfile,
  className,
}: ProfileTabsProps) {
  const visibleTabs = TABS.filter((tab) => !tab.ownOnly || isOwnProfile);

  return (
    <div
      className={cn(
        'flex border-b border-border dark:border-border-dark',
        className
      )}
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors',
              isActive
                ? 'text-primary'
                : 'text-text-muted dark:text-text-muted-dark hover:text-text dark:hover:text-text-dark'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>

            {/* Active indicator */}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
