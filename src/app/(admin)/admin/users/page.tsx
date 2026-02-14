'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, BadgeCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface AdminUser {
  id: number;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  avatar_color: string;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data?.users ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const toggleVerify = async (userId: number) => {
    setTogglingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, is_verified: data.data.is_verified } : u
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          User Management
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Search users and manage verification badges.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, username, or email..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-text outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:focus:border-primary"
        />
      </div>

      {/* Users list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : users.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted dark:text-text-muted-dark">
          No users found.
        </p>
      ) : (
        <div className="space-y-1">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
            >
              {/* Avatar */}
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <InitialsAvatar
                  name={user.display_name}
                  color={user.avatar_color}
                  size={40}
                  className="shrink-0"
                />
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-text dark:text-text-dark">
                    {user.display_name}
                  </p>
                  {user.is_verified && (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />
                  )}
                  {user.is_admin && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                      Admin
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-text-muted dark:text-text-muted-dark">
                  @{user.username} &middot; {user.email}
                </p>
              </div>

              {/* Toggle verified */}
              <button
                onClick={() => toggleVerify(user.id)}
                disabled={togglingId === user.id}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  user.is_verified
                    ? 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400'
                    : 'bg-slate-100 text-text-muted hover:bg-slate-200 dark:bg-slate-800 dark:text-text-muted-dark dark:hover:bg-slate-700'
                )}
              >
                {togglingId === user.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BadgeCheck className="h-3.5 w-3.5" />
                )}
                {user.is_verified ? 'Verified' : 'Verify'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
