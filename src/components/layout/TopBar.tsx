'use client';

import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TopBarProps {
  transparent?: boolean;
}

export function TopBar({ transparent = false }: TopBarProps) {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between px-4',
        transparent
          ? 'bg-transparent'
          : 'border-b border-border bg-surface/90 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90'
      )}
    >
      {/* Left: App logo */}
      <span className="text-lg font-bold text-primary">Free Luma</span>

      {/* Right: Notification bell */}
      <button
        type="button"
        className="relative rounded-lg p-2 text-text-muted transition-colors hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {/* Future: badge for unread notifications */}
      </button>
    </header>
  );
}
