'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  BadgeCheck,
  Loader2,
  Pencil,
  Ban,
  X,
  Check,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface UserActiveBan {
  id: number;
  reason: string;
  duration: string;
  expires_at: string | null;
  created_at: string;
}

interface AdminUser {
  id: number;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  role: string;
  status: string;
  is_admin: boolean;
  is_verified: boolean;
  mode: string;
  created_at: string;
  last_login_at: string | null;
  active_ban: UserActiveBan | null;
}

type RoleFilter = 'all' | 'user' | 'moderator' | 'admin';
type StatusFilterOption = 'all' | 'active' | 'banned' | 'deactivated' | 'pending_deletion';
type ModeFilter = 'all' | 'bible' | 'positivity';

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  moderator: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  user: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  banned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  deactivated: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pending_deletion: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

interface EditFormState {
  email: string;
  username: string;
  display_name: string;
  mode: string;
  is_verified: boolean;
  role: string;
}

export function UserBrowser() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Edit modal state
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    email: '',
    username: '',
    display_name: '',
    mode: 'bible',
    is_verified: false,
    role: 'user',
  });
  const [saving, setSaving] = useState(false);

  // Ban modal state
  const [banUser, setBanUser] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<string>('7d');
  const [banning, setBanning] = useState(false);

  const fetchUsers = useCallback(
    async (cursorVal?: string) => {
      if (cursorVal) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({ limit: '20' });
        if (search.trim()) params.set('search', search.trim());
        if (roleFilter !== 'all') params.set('role', roleFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (modeFilter !== 'all') params.set('mode', modeFilter);
        if (cursorVal) params.set('cursor', cursorVal);

        const res = await fetch(`/api/admin/users?${params}`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          const responseData = data.data || data;
          const newUsers = responseData.users || [];

          if (cursorVal) {
            setUsers((prev) => [...prev, ...newUsers]);
          } else {
            setUsers(newUsers);
          }
          setNextCursor(responseData.next_cursor || null);
          setHasMore(responseData.has_more || false);
        }
      } catch {
        toast.error('Failed to load users');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, roleFilter, statusFilter, modeFilter, toast]
  );

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchUsers(nextCursor);
    }
  };

  // Edit handlers
  const openEdit = (user: AdminUser) => {
    setEditUser(user);
    setEditForm({
      email: user.email,
      username: user.username,
      display_name: user.display_name,
      mode: user.mode,
      is_verified: user.is_verified,
      role: user.role,
    });
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);

    try {
      // Only send changed fields
      const updates: Record<string, unknown> = {};
      if (editForm.email !== editUser.email) updates.email = editForm.email;
      if (editForm.username !== editUser.username) updates.username = editForm.username;
      if (editForm.display_name !== editUser.display_name) updates.display_name = editForm.display_name;
      if (editForm.mode !== editUser.mode) updates.mode = editForm.mode;
      if (editForm.is_verified !== editUser.is_verified) updates.is_verified = editForm.is_verified;
      if (editForm.role !== editUser.role) updates.role = editForm.role;

      if (Object.keys(updates).length === 0) {
        toast.info('No changes to save');
        setEditUser(null);
        return;
      }

      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedUser = data.data?.user || data.user;
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editUser.id ? { ...u, ...updatedUser } : u
          )
        );
        toast.success('User updated');
        setEditUser(null);
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to update user');
      }
    } catch {
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  // Ban handlers
  const openBan = (user: AdminUser) => {
    setBanUser(user);
    setBanReason('');
    setBanDuration('7d');
  };

  const handleCreateBan = async () => {
    if (!banUser || !banReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    setBanning(true);

    try {
      const res = await fetch('/api/admin/bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: banUser.id,
          reason: banReason.trim(),
          duration: banDuration,
        }),
      });

      if (res.ok) {
        toast.success('User banned');
        setUsers((prev) =>
          prev.map((u) =>
            u.id === banUser.id ? { ...u, status: 'banned' } : u
          )
        );
        setBanUser(null);
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to ban user');
      }
    } catch {
      toast.error('Failed to ban user');
    } finally {
      setBanning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username, name, or email..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-text outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:focus:border-primary"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Role Filter */}
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-medium text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
            className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-medium text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
            <option value="deactivated">Deactivated</option>
            <option value="pending_deletion">Pending Deletion</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>

        {/* Mode Filter */}
        <div className="relative">
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
            className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-medium text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          >
            <option value="all">All Modes</option>
            <option value="bible">Bible</option>
            <option value="positivity">Positivity</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted dark:text-text-muted-dark">
          No users found.
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
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
                    <span className="truncate text-sm font-semibold text-text dark:text-text-dark">
                      {user.display_name}
                    </span>
                    {user.is_verified && (
                      <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />
                    )}
                  </div>
                  <p className="truncate text-xs text-text-muted dark:text-text-muted-dark">
                    @{user.username} &middot; {user.email}
                  </p>
                </div>

                {/* Badges */}
                <div className="hidden items-center gap-1.5 sm:flex">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                      ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES.user
                    )}
                  >
                    {user.role}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                      STATUS_BADGE_STYLES[user.status] || STATUS_BADGE_STYLES.active
                    )}
                  >
                    {user.status.replace('_', ' ')}
                  </span>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium capitalize text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                    {user.mode}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(user)}
                    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                    title="Edit user"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {user.status !== 'banned' && (
                    <button
                      onClick={() => openBan(user)}
                      className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:text-text-muted-dark dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      title="Ban user"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Extra info row */}
              <div className="mt-2 flex items-center gap-4 text-[10px] text-text-muted dark:text-text-muted-dark">
                <span>
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </span>
                {user.last_login_at && (
                  <span>
                    Last login {new Date(user.last_login_at).toLocaleDateString()}
                  </span>
                )}
                {user.active_ban && (
                  <span className="font-medium text-red-600 dark:text-red-400">
                    Banned: {user.active_ban.reason.substring(0, 50)}
                    {user.active_ban.expires_at && (
                      <> until {new Date(user.active_ban.expires_at).toLocaleDateString()}</>
                    )}
                  </span>
                )}
              </div>

              {/* Mobile badges */}
              <div className="mt-2 flex flex-wrap gap-1.5 sm:hidden">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                    ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES.user
                  )}
                >
                  {user.role}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                    STATUS_BADGE_STYLES[user.status] || STATUS_BADGE_STYLES.active
                  )}
                >
                  {user.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-xl bg-surface-hover px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text disabled:opacity-50 dark:bg-surface-hover-dark dark:text-text-muted-dark dark:hover:text-text-dark"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title={`Edit User: @${editUser?.username || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
              Email
            </label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none dark:border-border-dark dark:bg-background-dark dark:text-text-dark"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
              Username
            </label>
            <input
              type="text"
              value={editForm.username}
              onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none dark:border-border-dark dark:bg-background-dark dark:text-text-dark"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
              Display Name
            </label>
            <input
              type="text"
              value={editForm.display_name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, display_name: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text focus:border-primary focus:outline-none dark:border-border-dark dark:bg-background-dark dark:text-text-dark"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
                Role
              </label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text dark:border-border-dark dark:bg-background-dark dark:text-text-dark"
              >
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
                Mode
              </label>
              <select
                value={editForm.mode}
                onChange={(e) => setEditForm((prev) => ({ ...prev, mode: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text dark:border-border-dark dark:bg-background-dark dark:text-text-dark"
              >
                <option value="bible">Bible</option>
                <option value="positivity">Positivity</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditForm((prev) => ({ ...prev, is_verified: !prev.is_verified }))}
              className={cn(
                'flex h-5 w-9 items-center rounded-full transition-colors',
                editForm.is_verified ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
              )}
            >
              <span
                className={cn(
                  'h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  editForm.is_verified ? 'translate-x-[18px]' : 'translate-x-0.5'
                )}
              />
            </button>
            <span className="text-sm text-text dark:text-text-dark">Verified badge</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditUser(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Ban User Modal */}
      <Modal
        isOpen={!!banUser}
        onClose={() => setBanUser(null)}
        title={`Ban User: @${banUser?.username || ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
              Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {(['24h', '7d', '30d', 'permanent'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setBanDuration(d)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    banDuration === d
                      ? 'bg-red-500 text-white'
                      : 'bg-surface-hover text-text-muted hover:text-text dark:bg-surface-hover-dark dark:text-text-muted-dark'
                  )}
                >
                  {d === '24h' ? '24 Hours' : d === '7d' ? '7 Days' : d === '30d' ? '30 Days' : 'Permanent'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
              Reason
            </label>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Reason for banning this user..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none dark:border-border-dark dark:bg-background-dark dark:text-text-dark dark:placeholder:text-text-muted-dark"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBanUser(null)}
              disabled={banning}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={banning} onClick={handleCreateBan}>
              Ban User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
