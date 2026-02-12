'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sparkles,
  Heart,
  MessageSquare,
  BookOpen,
  Film,
  User,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import { CreatePicker } from './CreatePicker';

interface NavTab {
  href: string;
  icon: React.ElementType;
  label: string;
  bibleOnly?: boolean;
}

/**
 * Tab order per CONTEXT:
 * Daily | Prayer | Feed | (+) | Studies | Animations | Profile
 *
 * Prayer wall tab: bibleOnly (hidden for positivity mode)
 * Animations tab: bibleOnly (hidden for positivity mode)
 */
const LEFT_TABS: NavTab[] = [
  { href: '/', icon: Sparkles, label: 'Daily Post' },
  { href: '/prayer-wall', icon: Heart, label: 'Prayer Wall', bibleOnly: true },
  { href: '/feed', icon: MessageSquare, label: 'Feed' },
];

const RIGHT_TABS: NavTab[] = [
  { href: '/bible-studies', icon: BookOpen, label: 'Bible Studies' },
  { href: '/animations', icon: Film, label: 'Luma Animations', bibleOnly: true },
  { href: '/profile', icon: User, label: 'Profile' },
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

    return (
      <Link
        key={tab.href}
        href={tab.href}
        className={cn(
          'flex flex-col items-center justify-center p-2 transition-colors',
          isActive
            ? 'text-primary'
            : 'text-text-muted dark:text-text-muted-dark'
        )}
        aria-label={tab.label}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon
          className={cn('h-6 w-6', isActive && 'scale-110')}
          strokeWidth={isActive ? 2.5 : 2}
        />
      </Link>
    );
  };

  return (
    <>
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around',
          transparent
            ? 'bg-transparent'
            : 'border-t border-border bg-surface/90 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90'
        )}
        aria-label="Main navigation"
      >
        {/* Left tabs */}
        {visibleLeft.map(renderTab)}

        {/* Center '+' create button */}
        <button
          type="button"
          onClick={() => setPickerOpen((prev) => !prev)}
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
