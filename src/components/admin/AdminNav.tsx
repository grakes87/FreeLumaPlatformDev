'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Shield,
  Settings,
  BarChart3,
  Users,
  Key,
  Video,
  BookOpen,
  BookMarked,
  Clapperboard,
  Megaphone,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

interface AdminNavProps {
  pendingCount?: number;
}

export function AdminNav({ pendingCount = 0 }: AdminNavProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
    },
    {
      label: 'Moderation',
      href: '/admin/moderation',
      icon: Shield,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      label: 'Settings',
      href: '/admin/settings',
      icon: Settings,
    },
    {
      label: 'Users',
      href: '/admin/users',
      icon: Users,
    },
    {
      label: 'Activation Codes',
      href: '/admin/activation-codes',
      icon: Key,
    },
    {
      label: 'Videos',
      href: '/admin/videos',
      icon: Video,
    },
    {
      label: 'Workshops',
      href: '/admin/workshops',
      icon: BookOpen,
    },
    {
      label: 'Verse Categories',
      href: '/admin/verse-categories',
      icon: BookMarked,
    },
    {
      label: 'Content Production',
      href: '/admin/content-production',
      icon: Clapperboard,
    },
    {
      label: 'Announcements',
      href: '/admin/announcements',
      icon: Megaphone,
    },
    {
      label: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
    },
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 dark:border-border-dark">
        <h2 className="text-lg font-bold text-text dark:text-text-dark">
          Admin Panel
        </h2>
        <p className="text-xs text-text-muted dark:text-text-muted-dark">
          Free Luma Management
        </p>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary dark:bg-primary/20'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Back to App */}
      <div className="border-t border-border p-3 dark:border-border-dark">
        <Link
          href="/feed"
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to App
        </Link>
      </div>
    </aside>
  );
}
