'use client';

import { useState, useMemo } from 'react';
import {
  Users,
  Calendar,
  ChevronDown,
  User as UserIcon,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { DayData } from './DayCard';

interface Creator {
  id: number;
  name: string;
  user_id: number;
  user?: {
    id: number;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
  } | null;
  monthly_capacity: number;
  can_bible: boolean;
  can_positivity: boolean;
  active: boolean;
  languages: string[] | string;
}

interface AssignedTabProps {
  days: DayData[];
  month: string;
  mode: 'bible' | 'positivity';
  language: string;
  creators: Creator[];
  onRefresh: () => void;
}

type ViewMode = 'by-day' | 'by-creator';

export function AssignedTab({ days, month, mode, language, creators, onRefresh }: AssignedTabProps) {
  const toast = useToast();
  const [view, setView] = useState<ViewMode>('by-day');
  const [reassigningId, setReassigningId] = useState<number | null>(null);

  // Only show days that have a creator assigned
  const assignedDays = useMemo(
    () => days.filter((d) => d.creator !== null),
    [days]
  );

  // Eligible creators for this mode and language
  const eligibleCreators = useMemo(
    () =>
      creators.filter((c) => {
        if (!c.active) return false;
        if (mode === 'bible' ? !c.can_bible : !c.can_positivity) return false;
        const langs = Array.isArray(c.languages) ? c.languages : JSON.parse(c.languages as string || '[]');
        return langs.includes(language);
      }),
    [creators, mode, language]
  );

  // Group by creator for the by-creator view
  const byCreator = useMemo(() => {
    const map = new Map<number, { creator: Creator; days: DayData[] }>();
    for (const day of assignedDays) {
      if (!day.creator) continue;
      const cid = day.creator.id;
      if (!map.has(cid)) {
        const full = creators.find((c) => c.id === cid);
        if (full) {
          map.set(cid, { creator: full, days: [] });
        }
      }
      map.get(cid)?.days.push(day);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.creator.name.localeCompare(b.creator.name)
    );
  }, [assignedDays, creators]);

  const handleReassign = async (dailyContentId: number, creatorId: number) => {
    setReassigningId(dailyContentId);
    try {
      const res = await fetch('/api/admin/content-production/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reassign',
          daily_content_id: dailyContentId,
          creator_id: creatorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reassign failed');
      toast.success('Creator reassigned');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reassign failed');
    } finally {
      setReassigningId(null);
    }
  };

  const formatDate = (postDate: string) =>
    new Date(postDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const STATUS_COLORS: Record<string, string> = {
    empty: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    generated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    assigned: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="ml-auto flex rounded-lg border border-border dark:border-border-dark">
          <button
            type="button"
            onClick={() => setView('by-day')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'by-day'
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            <Calendar className="h-3.5 w-3.5" /> By Day
          </button>
          <button
            type="button"
            onClick={() => setView('by-creator')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'by-creator'
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            <Users className="h-3.5 w-3.5" /> By Creator
          </button>
        </div>
      </div>

      {assignedDays.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          <Users className="h-10 w-10" />
          <p className="text-sm">No days assigned yet. Use Auto-Assign in the Unassigned tab to distribute content to creators.</p>
        </div>
      ) : view === 'by-day' ? (
        /* By Day View */
        <div className="space-y-2">
          {assignedDays.map((day) => (
            <div
              key={day.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
            >
              <Calendar className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
              <span className="min-w-[7rem] text-sm font-medium text-text dark:text-text-dark">
                {formatDate(day.post_date)}
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  STATUS_COLORS[day.status] || STATUS_COLORS.empty
                )}
              >
                {day.status}
              </span>
              {day.title && (
                <span className="hidden truncate text-sm text-text-muted sm:block dark:text-text-muted-dark">
                  {day.title}
                </span>
              )}

              {/* Creator reassign dropdown */}
              <div className="ml-auto flex items-center gap-2">
                {reassigningId === day.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <div className="relative">
                    <select
                      value={day.creator?.id ?? ''}
                      onChange={(e) => {
                        const newId = parseInt(e.target.value, 10);
                        if (newId && newId !== day.creator?.id) {
                          handleReassign(day.id, newId);
                        }
                      }}
                      className={cn(
                        'appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs text-text',
                        'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50',
                        'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                      )}
                    >
                      {eligibleCreators.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* By Creator View */
        <div className="space-y-4">
          {byCreator.map(({ creator, days: creatorDays }) => (
            <div
              key={creator.id}
              className="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="flex items-center gap-3 border-b border-border px-4 py-3 dark:border-border-dark">
                {creator.user ? (
                  <UserAvatar
                    src={creator.user.avatar_url}
                    name={creator.name}
                    color={creator.user.avatar_color}
                    size={32}
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text dark:text-text-dark">
                    {creator.name}
                  </p>
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">
                    {creatorDays.length} / {creator.monthly_capacity} assigned
                  </p>
                </div>
              </div>
              <div className="divide-y divide-border dark:divide-border-dark">
                {creatorDays.map((day) => (
                  <div key={day.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="min-w-[7rem] text-sm text-text dark:text-text-dark">
                      {formatDate(day.post_date)}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_COLORS[day.status] || STATUS_COLORS.empty
                      )}
                    >
                      {day.status}
                    </span>
                    {day.title && (
                      <span className="truncate text-xs text-text-muted dark:text-text-muted-dark">
                        {day.title}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
