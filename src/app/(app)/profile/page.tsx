'use client';

import { User, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export default function ProfilePage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col items-center px-4 py-8">
      {/* Profile card placeholder */}
      <div className="mb-8 flex flex-col items-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
          style={{ backgroundColor: user?.avatar_color ?? '#6366F1' }}
        >
          {user?.display_name
            ? user.display_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
            : <User className="h-8 w-8" />}
        </div>
        <h2 className="mt-3 text-lg font-semibold text-text dark:text-text-dark">
          {user?.display_name ?? 'Profile'}
        </h2>
        {user?.username && (
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            @{user.username}
          </p>
        )}
      </div>

      {/* Appearance section */}
      <div className="w-full max-w-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
          Appearance
        </h3>
        <div className="overflow-hidden rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
          {mounted && THEME_OPTIONS.map((option, index) => {
            const Icon = option.icon;
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                  index > 0 && 'border-t border-border dark:border-border-dark',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-text hover:bg-background dark:text-text-dark dark:hover:bg-background-dark'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{option.label}</span>
                {isActive && (
                  <span className="ml-auto text-xs font-medium text-primary">Active</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-text-muted dark:text-text-muted-dark">
          Full profile and settings coming soon.
        </p>
      </div>
    </div>
  );
}
