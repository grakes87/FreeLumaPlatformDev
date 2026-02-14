'use client';

import { useEffect, useState } from 'react';
import {
  Flame,
  Calendar,
  MessageSquare,
  Heart,
  Users,
  UserPlus,
  FileText,
  HandHeart,
  BookOpen,
  Sparkles,
  Mail,
  Trophy,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface AccountStats {
  account: {
    join_date: string;
    email: string;
    content_mode: 'bible' | 'positivity';
  };
  activity: {
    total_posts: number;
    total_comments: number;
    total_reactions_given: number;
    total_prayers: number;
    followers_count: number;
    following_count: number;
  };
  streak: {
    current_streak: number;
    longest_streak: number;
    total_active_days: number;
  };
}

function formatJoinDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function StatItem({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <Icon className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
      <span className="text-lg font-bold text-text dark:text-text-dark">
        {value.toLocaleString()}
      </span>
      <span className="text-[10px] text-text-muted dark:text-text-muted-dark leading-tight text-center">
        {label}
      </span>
    </div>
  );
}

function StatsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Account Info skeleton */}
      <div className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <Skeleton height={16} className="w-24 mb-3" />
        <Skeleton height={14} className="w-48 mb-2" />
        <Skeleton height={14} className="w-36 mb-2" />
        <Skeleton height={24} className="w-20" />
      </div>

      {/* Activity skeleton */}
      <div className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <Skeleton height={16} className="w-20 mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton height={16} width={16} rounded />
              <Skeleton height={20} className="w-10" />
              <Skeleton height={10} className="w-14" />
            </div>
          ))}
        </div>
      </div>

      {/* Streak skeleton */}
      <div className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <Skeleton height={16} className="w-16 mb-3" />
        <div className="flex items-center justify-center gap-2 mb-3">
          <Skeleton height={48} width={48} rounded />
        </div>
        <div className="flex justify-around">
          <Skeleton height={14} className="w-20" />
          <Skeleton height={14} className="w-20" />
        </div>
      </div>
    </div>
  );
}

export function StatsPage() {
  const toast = useToast();
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/account/stats', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else {
          toast.error('Failed to load account stats.');
        }
      } catch {
        toast.error('Failed to load account stats.');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <StatsLoadingSkeleton />;
  }

  if (!stats) {
    return (
      <p className="text-center text-sm text-text-muted dark:text-text-muted-dark py-8">
        Unable to load stats.
      </p>
    );
  }

  const ModeIcon = stats.account.content_mode === 'bible' ? BookOpen : Sparkles;
  const modeLabel = stats.account.content_mode === 'bible' ? 'Bible' : 'Positivity';

  return (
    <div className="space-y-4">
      {/* Account Info Card */}
      <Card padding="sm" className="!p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark mb-3">
          Account Info
        </h4>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-text-muted dark:text-text-muted-dark shrink-0" />
            <span className="text-sm text-text dark:text-text-dark">
              Member since {formatJoinDate(stats.account.join_date)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-text-muted dark:text-text-muted-dark shrink-0" />
            <span className="text-sm text-text dark:text-text-dark truncate">
              {stats.account.email}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ModeIcon className="h-4 w-4 text-primary shrink-0" />
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                stats.account.content_mode === 'bible'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
              )}
            >
              {modeLabel} Mode
            </span>
          </div>
        </div>
      </Card>

      {/* Activity Card */}
      <Card padding="sm" className="!p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark mb-3">
          Activity
        </h4>

        <div className="grid grid-cols-3 gap-2">
          <StatItem icon={FileText} value={stats.activity.total_posts} label="Posts" />
          <StatItem icon={MessageSquare} value={stats.activity.total_comments} label="Comments" />
          <StatItem icon={Heart} value={stats.activity.total_reactions_given} label="Reactions" />
          <StatItem icon={HandHeart} value={stats.activity.total_prayers} label="Prayers" />
          <StatItem icon={Users} value={stats.activity.followers_count} label="Followers" />
          <StatItem icon={UserPlus} value={stats.activity.following_count} label="Following" />
        </div>
      </Card>

      {/* Streak Card */}
      <Card padding="sm" className="!p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark mb-3">
          Streaks
        </h4>

        {/* Current Streak - prominent */}
        <div className="flex flex-col items-center py-3">
          <Flame
            className={cn(
              'h-8 w-8 mb-1',
              stats.streak.current_streak > 0
                ? 'text-orange-500'
                : 'text-slate-300 dark:text-slate-600'
            )}
          />
          <span className="text-4xl font-bold text-text dark:text-text-dark">
            {stats.streak.current_streak}
          </span>
          <span className="text-sm text-text-muted dark:text-text-muted-dark">
            day streak
          </span>
        </div>

        {/* Sub-stats */}
        <div className="mt-2 flex items-center justify-around border-t border-border dark:border-border-dark pt-3">
          <div className="flex flex-col items-center gap-0.5">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-text dark:text-text-dark">
              {stats.streak.longest_streak}
            </span>
            <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
              Longest
            </span>
          </div>
          <div className="h-8 w-px bg-border dark:bg-border-dark" />
          <div className="flex flex-col items-center gap-0.5">
            <Zap className="h-4 w-4 text-green-500" />
            <span className="text-sm font-semibold text-text dark:text-text-dark">
              {stats.streak.total_active_days}
            </span>
            <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
              Active Days
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
