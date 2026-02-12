'use client';

import {
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  UserCog,
  Palette,
  Globe,
  Bell,
  ToggleLeft,
  LogOut,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { ProfileCard } from '@/components/profile/ProfileCard';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

interface SettingsItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
  href?: string;
  action?: 'logout' | 'appearance';
  danger?: boolean;
}

const SETTINGS_ITEMS: SettingsItem[] = [
  {
    icon: UserCog,
    label: 'Account Management',
    sublabel: 'Email, password',
    href: '/settings',
  },
  {
    icon: Palette,
    label: 'Appearance',
    sublabel: 'Dark mode',
    action: 'appearance',
  },
  {
    icon: Globe,
    label: 'Language Preference',
    href: '/settings',
  },
  {
    icon: Bell,
    label: 'Notification Settings',
    href: '/settings',
  },
  {
    icon: ToggleLeft,
    label: 'Mode',
    sublabel: 'Faith / Positivity',
    href: '/settings',
  },
  {
    icon: LogOut,
    label: 'Log Out',
    action: 'logout',
    danger: true,
  },
];

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAvatarChange = () => {
    refreshUser();
  };

  const handleSettingClick = (item: SettingsItem) => {
    if (item.action === 'logout') {
      handleLogout();
    } else if (item.action === 'appearance') {
      setShowAppearance(!showAppearance);
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      {/* Profile card */}
      <ProfileCard
        user={user}
        onAvatarChange={handleAvatarChange}
        className="mb-6"
      />

      {/* Settings list */}
      <div className="mb-2">
        <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
          Settings
        </h3>
        <Card padding="sm" className="overflow-hidden !p-0">
          {SETTINGS_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === SETTINGS_ITEMS.length - 1;

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => handleSettingClick(item)}
                  disabled={item.action === 'logout' && loggingOut}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                    'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    item.danger
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-text dark:text-text-dark',
                    item.action === 'logout' &&
                      loggingOut &&
                      'pointer-events-none opacity-60'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 opacity-70" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.sublabel && (
                      <span className="ml-1 text-xs text-text-muted dark:text-text-muted-dark">
                        - {item.sublabel}
                      </span>
                    )}
                  </div>
                  {!item.danger && (
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
                  )}
                </button>

                {/* Inline appearance options */}
                {item.action === 'appearance' && showAppearance && mounted && (
                  <div className="border-t border-border bg-slate-50/50 px-4 py-2 dark:border-border-dark dark:bg-slate-800/30">
                    <div className="flex gap-2">
                      {THEME_OPTIONS.map((option) => {
                        const ThemeIcon = option.icon;
                        const isActive = theme === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setTheme(option.value)}
                            className={cn(
                              'flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs transition-colors',
                              isActive
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-700'
                            )}
                          >
                            <ThemeIcon className="h-4 w-4" />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Divider */}
                {!isLast && (
                  <div className="mx-4 border-t border-border dark:border-border-dark" />
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
