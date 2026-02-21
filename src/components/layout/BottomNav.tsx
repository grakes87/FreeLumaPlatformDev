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
import { workshopLabel } from '@/lib/utils/workshopLabel';
import { CreatePicker } from './CreatePicker';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface NavTab {
  href: string;
  icon: React.ElementType;
  label: string;
  bibleOnly?: boolean;
  iconKey?: string; // e.g., 'tab-1' → resolves to /nav-icons/tab-1-{mode}.png
  iconSize?: string; // Tailwind size override, e.g., 'h-12 w-12'
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
  { href: '/', icon: Sparkles, label: 'Daily Post', iconKey: 'tab-1' },
  { href: '/prayer-wall', icon: Heart, label: 'Prayer Wall', bibleOnly: true, iconKey: 'tab-2' },
  { href: '/feed', icon: MessageSquare, label: 'Feed', iconKey: 'tab-3', iconSize: 'h-12 w-12' },
];

const RIGHT_TABS_BASE: Omit<NavTab, 'label'>[] = [
  { href: '/workshops', icon: Presentation, iconKey: 'tab-4' },
  { href: '/watch', icon: Play },
  { href: '/profile', icon: Sparkles },  // icon unused for profile tab
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
  const wl = workshopLabel(mode);

  const RIGHT_TABS: NavTab[] = RIGHT_TABS_BASE.map((t) => ({
    ...t,
    label: t.href === '/workshops' ? wl.plural : t.href === '/watch' ? 'Watch' : 'Profile',
  }));

  const filterTabs = (tabs: NavTab[]) =>
    tabs.filter((tab) => !tab.bibleOnly || mode === 'bible');

  const visibleLeft = filterTabs(LEFT_TABS);
  const visibleRight = filterTabs(RIGHT_TABS);

  const handleCreateSelect = useCallback(
    (type: 'post' | 'prayer_request' | 'workshop') => {
      setPickerOpen(false);
      if (type === 'prayer_request') {
        router.push('/prayer-wall?compose=prayer_request');
      } else if (type === 'workshop') {
        router.push('/workshops/create');
      } else {
        router.push('/feed?compose=post');
      }
    },
    [router]
  );

  const tabTutorialMap: Record<string, string> = {
    '/': 'tab-daily',
    '/prayer-wall': 'tab-prayer',
    '/feed': 'tab-feed',
    '/workshops': 'tab-workshops',
    '/watch': 'tab-watch',
    '/profile': 'tab-profile',
  };

  const renderTab = (tab: NavTab) => {
    const isActive =
      tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
    const Icon = tab.icon;
    const isProfile = tab.href === '/profile';

    return (
      <Link
        key={tab.href}
        href={tab.href}
        data-tutorial={tabTutorialMap[tab.href]}
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
            <UserAvatar
              src={user?.avatar_url}
              name={user?.display_name || '?'}
              color={user?.avatar_color || '#62BEBA'}
              size={28}
            />
          </div>
        ) : tab.iconKey ? (
          <div
            className={cn(tab.iconSize || 'h-10 w-10', 'transition-transform', isActive && 'scale-110')}
            style={{
              backgroundColor: 'currentColor',
              maskImage: `url('/nav-icons/${tab.iconKey}-${mode}.png')`,
              WebkitMaskImage: `url('/nav-icons/${tab.iconKey}-${mode}.png')`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            } as React.CSSProperties}
            aria-hidden="true"
          />
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
        data-tutorial="bottom-nav"
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
          data-tutorial="tab-create"
          onClick={() => {
            if (pathname === '/prayer-wall' || pathname.startsWith('/prayer-wall/')) {
              router.push('/prayer-wall?compose=prayer_request');
            } else if (pathname === '/feed' || pathname.startsWith('/feed/')) {
              router.push('/feed?compose=post');
            } else if (pathname === '/workshops' || pathname.startsWith('/workshops/')) {
              router.push('/workshops/create');
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
