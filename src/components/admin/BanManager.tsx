'use client';

import { useState, useEffect, useCallback } from 'react';
import { Ban, Shield, Loader2, Clock, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface BanUser {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  status: string;
}

interface BanRecord {
  id: number;
  user_id: number;
  banned_by: number;
  reason: string;
  duration: string;
  expires_at: string | null;
  lifted_at: string | null;
  created_at: string;
  user: BanUser;
  bannedBy: {
    id: number;
    username: string;
    display_name: string;
  };
}

type BanTab = 'active' | 'history';

const DURATION_LABELS: Record<string, string> = {
  '24h': '24 Hours',
  '7d': '7 Days',
  '30d': '30 Days',
  permanent: 'Permanent',
};

function getBanStatusColor(ban: BanRecord): string {
  if (ban.lifted_at) return 'border-l-green-500';
  if (ban.expires_at) {
    const expiresAt = new Date(ban.expires_at);
    const now = new Date();
    const hoursLeft = (expiresAt.getTime() - now.getTime()) / 3600000;
    if (hoursLeft < 24) return 'border-l-amber-500';
  }
  return 'border-l-red-500';
}

function getBanStatusBadge(ban: BanRecord): { label: string; className: string } {
  if (ban.lifted_at) {
    return {
      label: 'Lifted',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    };
  }
  if (ban.expires_at) {
    const expiresAt = new Date(ban.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      return {
        label: 'Expired',
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      };
    }
    const hoursLeft = (expiresAt.getTime() - now.getTime()) / 3600000;
    if (hoursLeft < 24) {
      return {
        label: 'Expiring soon',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      };
    }
  }
  return {
    label: 'Active',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
}

export function BanManager() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<BanTab>('active');
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [liftingId, setLiftingId] = useState<number | null>(null);

  // Create ban modal
  const [showCreateBan, setShowCreateBan] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<BanUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BanUser | null>(null);
  const [newBanReason, setNewBanReason] = useState('');
  const [newBanDuration, setNewBanDuration] = useState('7d');
  const [creating, setCreating] = useState(false);

  const fetchBans = useCallback(
    async (cursorVal?: string) => {
      if (cursorVal) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({ limit: '20' });
        if (activeTab === 'active') params.set('active', 'true');
        if (cursorVal) params.set('cursor', cursorVal);

        const res = await fetch(`/api/admin/bans?${params}`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          const responseData = data.data || data;
          const newBans = responseData.bans || [];

          if (cursorVal) {
            setBans((prev) => [...prev, ...newBans]);
          } else {
            setBans(newBans);
          }
          setNextCursor(responseData.next_cursor || null);
          setHasMore(responseData.has_more || false);
        }
      } catch {
        toast.error('Failed to load bans');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab, toast]
  );

  useEffect(() => {
    fetchBans();
  }, [fetchBans]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchBans(nextCursor);
    }
  };

  const handleLiftBan = async (banId: number) => {
    setLiftingId(banId);
    try {
      const res = await fetch(`/api/admin/bans/${banId}`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Ban lifted');
        setBans((prev) =>
          prev.map((b) =>
            b.id === banId ? { ...b, lifted_at: new Date().toISOString() } : b
          )
        );
        // If on active tab, remove the lifted ban
        if (activeTab === 'active') {
          setBans((prev) => prev.filter((b) => b.id !== banId));
        }
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to lift ban');
      }
    } catch {
      toast.error('Failed to lift ban');
    } finally {
      setLiftingId(null);
    }
  };

  // User search for create ban
  useEffect(() => {
    if (!userSearch.trim() || userSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/admin/users?search=${encodeURIComponent(userSearch.trim())}&limit=5`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          const responseData = data.data || data;
          setSearchResults(
            (responseData.users || []).map((u: AdminUserResult) => ({
              id: u.id,
              username: u.username,
              display_name: u.display_name,
              avatar_url: u.avatar_url,
              avatar_color: u.avatar_color,
              status: u.status,
            }))
          );
        }
      } catch {
        // silent
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearch]);

  const handleCreateBan = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }
    if (!newBanReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: selectedUser.id,
          reason: newBanReason.trim(),
          duration: newBanDuration,
        }),
      });

      if (res.ok) {
        toast.success('Ban created');
        setShowCreateBan(false);
        setSelectedUser(null);
        setUserSearch('');
        setNewBanReason('');
        fetchBans();
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to create ban');
      }
    } catch {
      toast.error('Failed to create ban');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Create Ban button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'active'
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-muted hover:text-text dark:bg-surface-hover-dark dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            Active Bans
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'history'
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-muted hover:text-text dark:bg-surface-hover-dark dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            Ban History
          </button>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateBan(true)}
        >
          <Ban className="h-3.5 w-3.5" />
          Create Ban
        </Button>
      </div>

      {/* Bans List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : bans.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface py-16 text-center dark:border-border-dark dark:bg-surface-dark">
          <Shield className="mx-auto h-10 w-10 text-text-muted dark:text-text-muted-dark" />
          <p className="mt-3 text-text-muted dark:text-text-muted-dark">
            {activeTab === 'active' ? 'No active bans' : 'No ban history'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bans.map((ban) => {
            const statusBadge = getBanStatusBadge(ban);
            const statusColor = getBanStatusColor(ban);

            return (
              <div
                key={ban.id}
                className={cn(
                  'rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark',
                  'border-l-4',
                  statusColor
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {ban.user?.avatar_url ? (
                      <img
                        src={ban.user.avatar_url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : ban.user ? (
                      <InitialsAvatar
                        name={ban.user.display_name}
                        color={ban.user.avatar_color}
                        size={36}
                        className="shrink-0"
                      />
                    ) : null}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text dark:text-text-dark">
                          {ban.user?.display_name || 'Unknown'}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium',
                            statusBadge.className
                          )}
                        >
                          {statusBadge.label}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted dark:text-text-muted-dark">
                        @{ban.user?.username || 'unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Lift Ban button */}
                  {!ban.lifted_at && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={liftingId === ban.id}
                      onClick={() => handleLiftBan(ban.id)}
                    >
                      Lift Ban
                    </Button>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-xs text-text-muted dark:text-text-muted-dark">
                  <p>
                    <span className="font-medium text-text dark:text-text-dark">Reason:</span>{' '}
                    {ban.reason}
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <span>
                      Duration: {DURATION_LABELS[ban.duration] || ban.duration}
                    </span>
                    {ban.expires_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires: {new Date(ban.expires_at).toLocaleString()}
                      </span>
                    )}
                    <span>
                      Banned by: @{ban.bannedBy?.username || 'unknown'}
                    </span>
                    <span>
                      Created: {new Date(ban.created_at).toLocaleDateString()}
                    </span>
                    {ban.lifted_at && (
                      <span className="text-green-600 dark:text-green-400">
                        Lifted: {new Date(ban.lifted_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

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

      {/* Create Ban Modal */}
      <Modal
        isOpen={showCreateBan}
        onClose={() => {
          setShowCreateBan(false);
          setSelectedUser(null);
          setUserSearch('');
          setSearchResults([]);
          setNewBanReason('');
        }}
        title="Create Ban"
        size="md"
      >
        <div className="space-y-4">
          {/* User Search */}
          {!selectedUser ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
                Search User
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by username or name..."
                  className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-sm text-text focus:border-primary focus:outline-none dark:border-border-dark dark:bg-background-dark dark:text-text-dark"
                />
              </div>

              {searchLoading && (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 rounded-xl border border-border bg-background p-1 dark:border-border-dark dark:bg-background-dark">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        setUserSearch('');
                        setSearchResults([]);
                      }}
                      disabled={u.status === 'banned'}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                        u.status === 'banned'
                          ? 'opacity-50'
                          : 'hover:bg-surface-hover dark:hover:bg-surface-hover-dark'
                      )}
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <InitialsAvatar name={u.display_name} color={u.avatar_color} size={28} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text dark:text-text-dark">
                          {u.display_name}
                        </p>
                        <p className="text-xs text-text-muted dark:text-text-muted-dark">@{u.username}</p>
                      </div>
                      {u.status === 'banned' && (
                        <span className="text-[10px] font-medium text-red-500">Already banned</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-background p-3 dark:bg-background-dark">
              {selectedUser.avatar_url ? (
                <img src={selectedUser.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <InitialsAvatar name={selectedUser.display_name} color={selectedUser.avatar_color} size={32} />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-text dark:text-text-dark">
                  {selectedUser.display_name}
                </p>
                <p className="text-xs text-text-muted dark:text-text-muted-dark">
                  @{selectedUser.username}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-1 text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
              >
                <Ban className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
              Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {(['24h', '7d', '30d', 'permanent'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setNewBanDuration(d)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    newBanDuration === d
                      ? 'bg-red-500 text-white'
                      : 'bg-surface-hover text-text-muted hover:text-text dark:bg-surface-hover-dark dark:text-text-muted-dark'
                  )}
                >
                  {DURATION_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
              Reason
            </label>
            <textarea
              value={newBanReason}
              onChange={(e) => setNewBanReason(e.target.value)}
              placeholder="Reason for banning this user..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none dark:border-border-dark dark:bg-background-dark dark:text-text-dark dark:placeholder:text-text-muted-dark"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateBan(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={creating} onClick={handleCreateBan}>
              Create Ban
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Type for the search results from admin users API
interface AdminUserResult {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  status: string;
}
