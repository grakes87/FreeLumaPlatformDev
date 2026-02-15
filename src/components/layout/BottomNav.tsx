'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sparkles,
  Heart,
  MessageSquare,
  Presentation,
  Play,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import { CreatePicker } from './CreatePicker';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface NavTab {
  href: string;
  icon: React.ElementType;
  label: string;
  bibleOnly?: boolean;
}

/**
 * Tab order:
 * Daily | Prayer | Feed | (+) | Workshops | Watch | Profile
 *
 * Prayer wall tab: bibleOnly (hidden for positivity mode)
 * Watch tab: visible for all modes (video library is mode-agnostic)
 * Workshops tab: visible for all modes
 */
const LEFT_TABS: NavTab[] = [
  { href: '/', icon: Sparkles, label: 'Daily Post' },
  { href: '/prayer-wall', icon: Heart, label: 'Prayer Wall', bibleOnly: true },
  { href: '/feed', icon: MessageSquare, label: 'Feed' },
];

const RIGHT_TABS: NavTab[] = [
  { href: '/workshops', icon: Presentation, label: 'Workshops' },
  { href: '/watch', icon: Play, label: 'Watch' },
  { href: '/profile', icon: Sparkles, label: 'Profile' },  // icon unused for profile tab
];

interface BottomNavProps {
  transparent?: boolean;
}

export function BottomNav({ transparent = false }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);

  const mode = user?.mode ?? 'bible';

  const filterTabs = (tabs: NavTab[]) =>
    tabs.filter((tab) => !tab.bibleOnly || mode === 'bible');

  const visibleLeft = filterTabs(LEFT_TABS);
  const visibleRight = filterTabs(RIGHT_TABS);

  const handleCreateSelect = useCallback(
    (type: 'post' | 'prayer_request') => {
      setPickerOpen(false);
      // Navigate to feed page with composer query param
      if (type === 'prayer_request') {
        router.push('/prayer-wall?compose=prayer_request');
      } else {
        router.push('/feed?compose=post');
      }
    },
    [router]
  );

  const renderTab = (tab: NavTab) => {
    const isActive =
      tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
    const Icon = tab.icon;
    const isProfile = tab.href === '/profile';

    return (
      <Link
        key={tab.href}
        href={tab.href}
        className={cn(
          'flex flex-col items-center justify-center p-2 transition-colors',
          !isProfile && (transparent
            ? isActive
              ? 'text-white'
              : 'text-white/70'
            : isActive
              ? 'text-primary'
              : 'text-text-muted dark:text-text-muted-dark')
        )}
        aria-label={tab.label}
        aria-current={isActive ? 'page' : undefined}
      >
        {isProfile ? (
          <div className={cn(
            'flex items-center justify-center rounded-full',
            isActive && 'ring-2 ring-primary'
          )}>
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <InitialsAvatar
                name={user?.display_name || '?'}
                color={user?.avatar_color || '#62BEBA'}
                size={28}
              />
            )}
          </div>
        ) : (
          <Icon
            className={cn('h-6 w-6', isActive && 'scale-110')}
            strokeWidth={isActive ? 2.5 : 2}
          />
        )}
      </Link>
    );
  };

  return (
    <>
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around',
          transparent
            ? 'border-t border-white/20 bg-black/30 backdrop-blur-md'
            : 'border-t border-border bg-surface/90 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90'
        )}
        style={{
          height: `calc(4rem + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        aria-label="Main navigation"
      >
        {/* Left tabs */}
        {visibleLeft.map(renderTab)}

        {/* Center '+' create button */}
        <button
          type="button"
          onClick={() => {
            if (pathname === '/prayer-wall' || pathname.startsWith('/prayer-wall/')) {
              router.push('/prayer-wall?compose=prayer_request');
            } else if (pathname === '/feed' || pathname.startsWith('/feed/')) {
              router.push('/feed?compose=post');
            } else {
              setPickerOpen((prev) => !prev);
            }
          }}
          className={cn(
            'flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full shadow-lg transition-transform',
            'bg-primary text-white',
            'hover:scale-105 active:scale-95',
            pickerOpen && 'rotate-45'
          )}
          aria-label="Create new content"
          aria-expanded={pickerOpen}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>

        {/* Right tabs */}
        {visibleRight.map(renderTab)}
      </nav>

      {/* Create Picker overlay */}
      <CreatePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleCreateSelect}
      />
    </>
  );
}
