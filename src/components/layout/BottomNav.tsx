'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  Heart,
  MessageSquare,
  BookOpen,
  Film,
  User,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';

interface NavTab {
  href: string;
  icon: React.ElementType;
  label: string;
  bibleOnly?: boolean;
}

const TABS: NavTab[] = [
  { href: '/', icon: Sparkles, label: 'Daily Post' },
  { href: '/prayer-wall', icon: Heart, label: 'Prayer Wall' },
  { href: '/feed', icon: MessageSquare, label: 'Feed' },
  { href: '/bible-studies', icon: BookOpen, label: 'Bible Studies' },
  { href: '/animations', icon: Film, label: 'Luma Animations', bibleOnly: true },
  { href: '/profile', icon: User, label: 'Profile' },
];

interface BottomNavProps {
  transparent?: boolean;
}

export function BottomNav({ transparent = false }: BottomNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const mode = user?.mode ?? 'bible';
  const visibleTabs = TABS.filter(
    (tab) => !tab.bibleOnly || mode === 'bible'
  );

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around',
        transparent
          ? 'bg-transparent'
          : 'border-t border-border bg-surface/90 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90'
      )}
      aria-label="Main navigation"
    >
      {visibleTabs.map((tab) => {
        const isActive = tab.href === '/'
          ? pathname === '/'
          : pathname.startsWith(tab.href);
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
      })}
    </nav>
  );
}
