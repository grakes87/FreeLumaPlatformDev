'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Pencil,
  XCircle,
  Calendar,
  Clock,
  Users,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  ExternalLink,
  UserPlus,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { CreateWorkshopForm } from '@/components/workshop/CreateWorkshopForm';
import { cn } from '@/lib/utils/cn';

// --- Types ---

interface WorkshopHost {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string | null;
  can_host: boolean;
}

interface WorkshopCategory {
  id: number;
  name: string;
  slug: string;
}

interface Workshop {
  id: number;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: 'scheduled' | 'lobby' | 'live' | 'ended' | 'cancelled';
  is_private: boolean;
  max_capacity: number | null;
  attendee_count: number;
  host_id: number;
  category_id: number | null;
  series_id: number | null;
  recording_url: string | null;
  created_by_admin_id: number | null;
  created_at: string;
  host: WorkshopHost;
  category: WorkshopCategory | null;
  createdByAdmin: { id: number; display_name: string; username: string } | null;
}

interface SearchUser {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string | null;
  status: string;
}

type StatusTab = 'all' | 'scheduled' | 'live' | 'ended' | 'cancelled';

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'ended', label: 'Ended' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  lobby: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  live: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ended: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

function InitialsAvatar({ name, color }: { name: string; color: string | null }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: color || '#6366f1' }}
    >
      {initials}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- Create on Behalf Form ---

function CreateOnBehalfForm({
  host,
  categories,
  onSuccess,
  onCancel,
}: {
  host: SearchUser;
  categories: WorkshopCategory[];
  onSuccess: (username: string) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [workshopMode, setWorkshopMode] = useState<'bible' | 'positivity'>('bible');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [byDay, setByDay] = useState<string[]>([]);
  const [endCondition, setEndCondition] = useState<'never' | 'count' | 'until'>('never');
  const [occurrenceCount, setOccurrenceCount] = useState(4);
  const [untilDate, setUntilDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title || title.length < 3) {
      setFormError('Title must be at least 3 characters');
      return;
    }
    if (!isRecurring && (!date || !time)) {
      setFormError('Date and time are required');
      return;
    }
    if (isRecurring && !time) {
      setFormError('Time is required for recurring workshops');
      return;
    }

    if (!isRecurring) {
      const scheduledAt = new Date(`${date}T${time}`);
      const minTime = new Date(Date.now() + 15 * 60 * 1000);
      if (scheduledAt < minTime) {
        setFormError('Workshop must be scheduled at least 15 minutes from now');
        return;
      }
    }

    setSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        action: 'create_on_behalf',
        host_id: host.id,
        title,
        description: description || undefined,
        category_id: categoryId,
        duration_minutes: durationMinutes,
        is_private: isPrivate,
        mode: workshopMode,
        is_recurring: isRecurring,
      };

      if (isRecurring) {
        body.frequency = frequency;
        body.time_of_day = time;
        body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if ((frequency === 'weekly' || frequency === 'biweekly') && byDay.length > 0) {
          body.byDay = byDay;
        }
        body.endCondition = endCondition;
        if (endCondition === 'count') body.occurrenceCount = occurrenceCount;
        if (endCondition === 'until') body.untilDate = untilDate;
      } else {
        body.scheduled_at = new Date(`${date}T${time}`).toISOString();
      }

      const res = await fetch('/api/admin/workshops', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create workshop');
        return;
      }

      toast.success(`Workshop created for @${host.username}`);
      onSuccess(host.username);
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Selected Host Display */}
      <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950">
        {host.avatar_url ? (
          <img src={host.avatar_url} alt={host.display_name} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <InitialsAvatar name={host.display_name} color={host.avatar_color} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text dark:text-text-dark">
            {host.display_name}
          </p>
          <p className="text-xs text-text-muted dark:text-text-muted-dark">@{host.username}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1 text-text-muted transition-colors hover:bg-white hover:text-text dark:text-text-muted-dark dark:hover:bg-slate-800 dark:hover:text-text-dark"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Title */}
      <Input
        label="Title"
        placeholder="e.g., Morning Prayer Circle"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        maxLength={200}
      />

      {/* Description */}
      <div className="w-full">
        <label
          htmlFor="proxy-description"
          className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark"
        >
          Description
        </label>
        <textarea
          id="proxy-description"
          rows={3}
          placeholder="What will this workshop cover? (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          className={cn(
            'w-full rounded-xl border border-border bg-surface px-4 py-3 text-text transition-colors placeholder:text-text-muted',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
            'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
            'resize-none'
          )}
        />
      </div>

      {/* Category */}
      <div className="w-full">
        <label
          htmlFor="proxy-category"
          className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark"
        >
          Category
        </label>
        <select
          id="proxy-category"
          value={categoryId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setCategoryId(val ? parseInt(val, 10) : null);
          }}
          className={cn(
            'w-full rounded-xl border border-border bg-surface px-4 py-3 text-text transition-colors',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
            'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
          )}
        >
          <option value="">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Mode selector */}
      <div className="w-full">
        <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
          Mode
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setWorkshopMode('bible')}
            className={cn(
              'rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all',
              workshopMode === 'bible'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-muted hover:border-primary/40'
            )}
          >
            Faith
          </button>
          <button
            type="button"
            onClick={() => setWorkshopMode('positivity')}
            className={cn(
              'rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all',
              workshopMode === 'positivity'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-muted hover:border-primary/40'
            )}
          >
            Positivity
          </button>
        </div>
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        {!isRecurring && (
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        )}
        <Input
          label="Time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>

      {/* Duration */}
      <Input
        label="Duration (minutes)"
        type="number"
        placeholder="Estimated duration (optional)"
        value={durationMinutes ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          setDurationMinutes(val ? parseInt(val, 10) : null);
        }}
        min={15}
        max={480}
      />

      {/* Privacy toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark">
        <div>
          <p className="text-sm font-medium text-text dark:text-text-dark">
            Private (invite-only)
          </p>
          <p className="text-xs text-text-muted dark:text-text-muted-dark">
            Only invited users can see and join
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPrivate}
          onClick={() => setIsPrivate(!isPrivate)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
            isPrivate ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
              isPrivate ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {/* Recurring toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark">
        <div>
          <p className="text-sm font-medium text-text dark:text-text-dark">
            Recurring series
          </p>
          <p className="text-xs text-text-muted dark:text-text-muted-dark">
            Automatically generate workshop instances
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isRecurring}
          onClick={() => setIsRecurring(!isRecurring)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
            isRecurring ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
              isRecurring ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {/* Recurring options */}
      {isRecurring && (
        <div className="space-y-3 rounded-xl border border-border bg-slate-50 p-4 dark:border-border-dark dark:bg-slate-900">
          {/* Frequency */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Day picker for weekly/biweekly */}
          {(frequency === 'weekly' || frequency === 'biweekly') && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                Days
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'MO', label: 'Mon' },
                  { key: 'TU', label: 'Tue' },
                  { key: 'WE', label: 'Wed' },
                  { key: 'TH', label: 'Thu' },
                  { key: 'FR', label: 'Fri' },
                  { key: 'SA', label: 'Sat' },
                  { key: 'SU', label: 'Sun' },
                ].map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => {
                      setByDay((prev) =>
                        prev.includes(d.key) ? prev.filter((x) => x !== d.key) : [...prev, d.key]
                      );
                    }}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      byDay.includes(d.key)
                        ? 'bg-primary text-white'
                        : 'bg-slate-200 text-text-muted hover:bg-slate-300 dark:bg-slate-700 dark:text-text-muted-dark dark:hover:bg-slate-600'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End condition */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Ends
            </label>
            <select
              value={endCondition}
              onChange={(e) => setEndCondition(e.target.value as typeof endCondition)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            >
              <option value="never">Never</option>
              <option value="count">After N occurrences</option>
              <option value="until">Until date</option>
            </select>
          </div>

          {endCondition === 'count' && (
            <Input
              label="Number of occurrences"
              type="number"
              value={occurrenceCount}
              onChange={(e) => setOccurrenceCount(parseInt(e.target.value, 10) || 4)}
              min={1}
              max={52}
            />
          )}

          {endCondition === 'until' && (
            <Input
              label="End date"
              type="date"
              value={untilDate}
              onChange={(e) => setUntilDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          )}
        </div>
      )}

      {/* Error */}
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
        </div>
      )}

      {/* Submit */}
      <Button type="submit" fullWidth loading={submitting} size="lg">
        Create Workshop for @{host.username}
      </Button>
    </form>
  );
}

// --- Host Search Picker ---

function HostSearchPicker({ onSelect }: { onSelect: (user: SearchUser) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          search: query.trim(),
          status: 'active',
          limit: '10',
        });
        const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setResults(
            data.users.map((u: Record<string, unknown>) => ({
              id: u.id,
              display_name: u.display_name,
              username: u.username,
              avatar_url: u.avatar_url,
              avatar_color: u.avatar_color,
              status: u.status,
            }))
          );
        }
      } catch {
        // Non-critical
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
        <input
          type="text"
          placeholder="Search by name or username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className={cn(
            'w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-text transition-colors placeholder:text-text-muted',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
            'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark'
          )}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted dark:text-text-muted-dark" />
        )}
      </div>

      {results.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-border dark:border-border-dark">
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelect(user)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover dark:hover:bg-surface-hover-dark"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.display_name} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <InitialsAvatar name={user.display_name} color={user.avatar_color} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text dark:text-text-dark">
                  {user.display_name}
                </p>
                <p className="text-xs text-text-muted dark:text-text-muted-dark">@{user.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {query.trim() && !searching && results.length === 0 && (
        <p className="py-4 text-center text-sm text-text-muted dark:text-text-muted-dark">
          No active users found matching &ldquo;{query}&rdquo;
        </p>
      )}

      {!query.trim() && (
        <p className="py-4 text-center text-sm text-text-muted dark:text-text-muted-dark">
          Search for a user to host this workshop
        </p>
      )}
    </div>
  );
}

// --- Main Page ---

export default function AdminWorkshopsPage() {
  const toast = useToast();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit modal state
  const [editWorkshop, setEditWorkshop] = useState<Workshop | null>(null);

  // Cancel modal state
  const [cancelWorkshop, setCancelWorkshop] = useState<Workshop | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Host action state
  const [togglingHostId, setTogglingHostId] = useState<number | null>(null);

  // Create on behalf modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedHost, setSelectedHost] = useState<SearchUser | null>(null);
  const [wsCategories, setWsCategories] = useState<WorkshopCategory[]>([]);

  const fetchWorkshops = useCallback(
    async (cursor?: string) => {
      try {
        const params = new URLSearchParams();
        if (activeTab !== 'all') params.set('status', activeTab);
        if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
        if (cursor) params.set('cursor', cursor);
        params.set('limit', '20');

        const res = await fetch(`/api/admin/workshops?${params}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to fetch');
        }

        const data = await res.json();
        if (cursor) {
          setWorkshops((prev) => [...prev, ...data.workshops]);
        } else {
          setWorkshops(data.workshops);
        }
        setNextCursor(data.nextCursor);
      } catch {
        toast.error('Failed to load workshops');
      }
    },
    [activeTab, debouncedQuery, toast]
  );

  // Initial load + refetch on tab/search change
  useEffect(() => {
    setLoading(true);
    fetchWorkshops().finally(() => setLoading(false));
  }, [fetchWorkshops]);

  // Debounced search -- updates debouncedQuery after 300ms
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await fetchWorkshops(nextCursor);
    setLoadingMore(false);
  };

  // Cancel a workshop via admin endpoint
  const handleCancel = async () => {
    if (!cancelWorkshop) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/admin/workshops', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'cancel_workshop',
          workshopId: cancelWorkshop.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to cancel workshop');
        return;
      }

      toast.success('Workshop cancelled');
      setCancelWorkshop(null);
      // Update locally
      setWorkshops((prev) =>
        prev.map((w) =>
          w.id === cancelWorkshop.id ? { ...w, status: 'cancelled' as const } : w
        )
      );
    } catch {
      toast.error('Failed to cancel workshop');
    } finally {
      setCancelling(false);
    }
  };

  // Toggle host privileges
  const handleToggleHost = async (host: WorkshopHost) => {
    setTogglingHostId(host.id);
    try {
      const action = host.can_host ? 'revoke_host' : 'restore_host';
      const res = await fetch('/api/admin/workshops', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, userId: host.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || `Failed to ${action.replace('_', ' ')}`);
        return;
      }

      const newCanHost = !host.can_host;
      toast.success(newCanHost ? 'Hosting privileges restored' : 'Hosting privileges revoked');
      // Update locally
      setWorkshops((prev) =>
        prev.map((w) =>
          w.host_id === host.id
            ? { ...w, host: { ...w.host, can_host: newCanHost } }
            : w
        )
      );
    } catch {
      toast.error('Failed to update host privileges');
    } finally {
      setTogglingHostId(null);
    }
  };

  // Build edit initialData from workshop
  const getEditData = (w: Workshop) => {
    const d = new Date(w.scheduled_at);
    return {
      title: w.title,
      description: w.description || '',
      category_id: w.category_id,
      date: d.toISOString().split('T')[0],
      time: d.toTimeString().slice(0, 5),
      duration_minutes: w.duration_minutes,
      is_private: w.is_private,
    };
  };

  // Open create on behalf modal and fetch categories
  const openCreateModal = async () => {
    setShowCreateModal(true);
    setSelectedHost(null);
    try {
      const res = await fetch('/api/workshops/categories', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWsCategories(data.categories || []);
      }
    } catch {
      // Non-critical
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    setSelectedHost(null);
    // Refetch workshops
    setLoading(true);
    fetchWorkshops().finally(() => setLoading(false));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text-dark">
            Workshop Management
          </h1>
          <p className="text-text-muted dark:text-text-muted-dark">
            View, edit, cancel workshops and manage host privileges
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreateModal}>
          <UserPlus className="h-4 w-4" />
          Create on Behalf
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.value
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
        <Input
          placeholder="Search workshops by title..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : workshops.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
          <BookOpen className="h-12 w-12 text-text-muted dark:text-text-muted-dark" />
          <p className="text-text-muted dark:text-text-muted-dark">
            {searchQuery ? 'No workshops match your search.' : 'No workshops found.'}
          </p>
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {workshops.map((workshop) => (
            <div
              key={workshop.id}
              className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="flex gap-4">
                {/* Host Avatar */}
                <div className="shrink-0">
                  {workshop.host.avatar_url ? (
                    <img
                      src={workshop.host.avatar_url}
                      alt={workshop.host.display_name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar
                      name={workshop.host.display_name}
                      color={workshop.host.avatar_color}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-text-muted dark:bg-gray-800 dark:text-text-muted-dark">
                      #{workshop.id}
                    </span>
                    <h3 className="truncate font-semibold text-text dark:text-text-dark">
                      {workshop.title}
                    </h3>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        STATUS_BADGE[workshop.status] || STATUS_BADGE.ended
                      )}
                    >
                      {workshop.status}
                    </span>
                    {workshop.is_private && (
                      <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        Private
                      </span>
                    )}
                    {workshop.created_by_admin_id && (
                      <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        Created by admin
                      </span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted dark:text-text-muted-dark">
                    <span className="font-medium text-text dark:text-text-dark">
                      @{workshop.host.username}
                    </span>
                    {workshop.category && (
                      <span className="rounded bg-surface-hover px-2 py-0.5 dark:bg-surface-hover-dark">
                        {workshop.category.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(workshop.scheduled_at)}
                    </span>
                    {workshop.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {workshop.duration_minutes}m
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {workshop.attendee_count}
                    </span>
                    {workshop.series_id && (
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        Series #{workshop.series_id}
                      </span>
                    )}
                  </div>

                  {/* Host privilege badge */}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handleToggleHost(workshop.host)}
                      disabled={togglingHostId === workshop.host.id}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                        workshop.host.can_host
                          ? 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30',
                        togglingHostId === workshop.host.id && 'opacity-50'
                      )}
                    >
                      {workshop.host.can_host ? (
                        <>
                          <ShieldCheck className="h-3 w-3" />
                          Can Host — Revoke
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-3 w-3" />
                          Revoked — Restore
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-start gap-1">
                  {workshop.status === 'scheduled' && (
                    <button
                      type="button"
                      onClick={() => setEditWorkshop(workshop)}
                      className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {workshop.status !== 'ended' && workshop.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => setCancelWorkshop(workshop)}
                      className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500 dark:text-text-muted-dark dark:hover:bg-red-500/10"
                      title="Cancel Workshop"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                  <a
                    href={`/workshops/${workshop.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                    title="View Detail"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

      {/* Load More */}
      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            onClick={handleLoadMore}
            loading={loadingMore}
          >
            Load More
          </Button>
        </div>
      )}
        </>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={editWorkshop !== null}
        onClose={() => setEditWorkshop(null)}
        title="Edit Workshop"
        size="lg"
      >
        {editWorkshop && (
          <CreateWorkshopForm
            mode="edit"
            workshopId={editWorkshop.id}
            initialData={getEditData(editWorkshop)}
            onSuccess={() => {
              setEditWorkshop(null);
              // Refetch to get updated data
              setLoading(true);
              fetchWorkshops().finally(() => setLoading(false));
            }}
          />
        )}
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={cancelWorkshop !== null}
        onClose={() => setCancelWorkshop(null)}
        title="Cancel Workshop"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            Are you sure you want to cancel{' '}
            <span className="font-semibold text-text dark:text-text-dark">
              &ldquo;{cancelWorkshop?.title}&rdquo;
            </span>
            ?
          </p>
          {cancelWorkshop && cancelWorkshop.attendee_count > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {cancelWorkshop.attendee_count} attendee
                {cancelWorkshop.attendee_count !== 1 ? 's' : ''} will be notified
                about this cancellation.
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setCancelWorkshop(null)}
              disabled={cancelling}
              className="flex-1"
            >
              Keep
            </Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              loading={cancelling}
              className="flex-1"
            >
              Cancel Workshop
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create on Behalf Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedHost(null);
        }}
        title="Create Workshop on Behalf"
        size="lg"
      >
        {selectedHost ? (
          <CreateOnBehalfForm
            host={selectedHost}
            categories={wsCategories}
            onSuccess={handleCreateSuccess}
            onCancel={() => setSelectedHost(null)}
          />
        ) : (
          <HostSearchPicker onSelect={setSelectedHost} />
        )}
      </Modal>
    </div>
  );
}
