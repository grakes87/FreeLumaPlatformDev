'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Bot,
  X,
  Check,
  Users,
  Globe,
  BookOpen,
  Sun,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { UserAvatar } from '@/components/ui/UserAvatar';

/* ─── Types ─── */

interface CreatorUser {
  id: number;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface Creator {
  id: number;
  user_id: number;
  name: string;
  bio: string | null;
  link_1: string | null;
  link_2: string | null;
  link_3: string | null;
  languages: string[];
  monthly_capacity: number;
  can_bible: boolean;
  can_positivity: boolean;
  is_ai: boolean;
  heygen_avatar_id: string | null;
  active: boolean;
  user?: CreatorUser | null;
}

interface UserSearchResult {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface CreatorManagerProps {
  onCreatorChange?: () => void;
}

/* ─── Form State ─── */

interface CreatorFormData {
  user_id: number | null;
  name: string;
  bio: string;
  link_1: string;
  link_2: string;
  link_3: string;
  languages: string[];
  monthly_capacity: number;
  can_bible: boolean;
  can_positivity: boolean;
  is_ai: boolean;
  heygen_avatar_id: string;
}

const EMPTY_FORM: CreatorFormData = {
  user_id: null,
  name: '',
  bio: '',
  link_1: '',
  link_2: '',
  link_3: '',
  languages: ['en'],
  monthly_capacity: 15,
  can_bible: true,
  can_positivity: true,
  is_ai: false,
  heygen_avatar_id: '',
};

const AVAILABLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
];

/* ─── Component ─── */

export function CreatorManager({ onCreatorChange }: CreatorManagerProps) {
  const toast = useToast();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CreatorFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // User search state
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCreators = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/content-production/creators', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCreators(data.creators || []);
      }
    } catch {
      toast.error('Failed to load creators');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  // User search with debounce
  const searchUsers = useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
        setUserResults([]);
        return;
      }

      setSearchingUsers(true);
      try {
        const res = await fetch(
          `/api/admin/users?search=${encodeURIComponent(query.trim())}&limit=5`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          setUserResults(data.users || []);
        }
      } catch {
        // Silently fail for search
      } finally {
        setSearchingUsers(false);
      }
    },
    []
  );

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchUsers(userQuery), 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [userQuery, searchUsers]);

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSelectedUser(null);
    setUserQuery('');
    setUserResults([]);
    setShowForm(true);
  };

  const openEditForm = (creator: Creator) => {
    setForm({
      user_id: creator.user_id,
      name: creator.name,
      bio: creator.bio || '',
      link_1: creator.link_1 || '',
      link_2: creator.link_2 || '',
      link_3: creator.link_3 || '',
      languages: creator.languages,
      monthly_capacity: creator.monthly_capacity,
      can_bible: creator.can_bible,
      can_positivity: creator.can_positivity,
      is_ai: creator.is_ai,
      heygen_avatar_id: creator.heygen_avatar_id || '',
    });
    setEditingId(creator.id);
    setSelectedUser(creator.user ? {
      id: creator.user.id,
      username: creator.user.username,
      display_name: creator.name,
      avatar_url: creator.user.avatar_url,
      avatar_color: creator.user.avatar_color,
    } : null);
    setUserQuery('');
    setUserResults([]);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedUser(null);
  };

  const selectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setForm((prev) => ({ ...prev, user_id: user.id }));
    setUserQuery('');
    setUserResults([]);
  };

  const toggleLanguage = (code: string) => {
    setForm((prev) => {
      const has = prev.languages.includes(code);
      const next = has
        ? prev.languages.filter((l) => l !== code)
        : [...prev.languages, code];
      return { ...prev, languages: next.length > 0 ? next : prev.languages };
    });
  };

  const handleSave = async () => {
    if (!form.user_id && !editingId) {
      toast.error('Please select a user');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        bio: form.bio.trim() || undefined,
        link_1: form.link_1.trim() || undefined,
        link_2: form.link_2.trim() || undefined,
        link_3: form.link_3.trim() || undefined,
        languages: form.languages,
        monthly_capacity: form.monthly_capacity,
        can_bible: form.can_bible,
        can_positivity: form.can_positivity,
        is_ai: form.is_ai,
        heygen_avatar_id: form.is_ai && form.heygen_avatar_id.trim()
          ? form.heygen_avatar_id.trim()
          : undefined,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/admin/content-production/creators/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        payload.user_id = form.user_id;
        res = await fetch('/api/admin/content-production/creators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      toast.success(editingId ? 'Creator updated' : 'Creator created');
      closeForm();
      fetchCreators();
      onCreatorChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/content-production/creators/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deactivation failed');

      toast.success(
        `Creator deactivated. ${data.unassigned_count || 0} days unassigned.`
      );
      setConfirmDeleteId(null);
      fetchCreators();
      onCreatorChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deactivation failed');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text dark:text-text-dark">
          Content Creators
        </h3>
        <Button size="sm" onClick={openCreateForm}>
          <Plus className="h-4 w-4" /> Add Creator
        </Button>
      </div>

      {/* Creators List */}
      {creators.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          <Users className="h-10 w-10" />
          <p className="text-sm">No creators yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {creators.map((creator) => (
            <div
              key={creator.id}
              className={cn(
                'rounded-xl border bg-surface p-4 dark:bg-surface-dark',
                creator.active
                  ? 'border-border dark:border-border-dark'
                  : 'border-border/50 opacity-60 dark:border-border-dark/50'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                {creator.user ? (
                  <UserAvatar
                    src={creator.user.avatar_url}
                    name={creator.name}
                    color={creator.user.avatar_color}
                    size={40}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {creator.is_ai ? (
                      <Bot className="h-5 w-5" />
                    ) : (
                      <Users className="h-5 w-5" />
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-text dark:text-text-dark">
                      {creator.name}
                    </p>
                    {creator.is_ai && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        AI
                      </span>
                    )}
                    {!creator.active && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  {creator.user && (
                    <p className="text-xs text-text-muted dark:text-text-muted-dark">
                      @{creator.user.username}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {/* Languages */}
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-text-muted dark:bg-slate-700 dark:text-text-muted-dark">
                      <Globe className="h-3 w-3" />
                      {creator.languages.join(', ')}
                    </span>

                    {/* Capacity */}
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-text-muted dark:bg-slate-700 dark:text-text-muted-dark">
                      <Users className="h-3 w-3" />
                      {creator.monthly_capacity}/mo
                    </span>

                    {/* Mode flags */}
                    {creator.can_bible && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <BookOpen className="h-3 w-3" /> Bible
                      </span>
                    )}
                    {creator.can_positivity && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <Sun className="h-3 w-3" /> Positivity
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {creator.active && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEditForm(creator)}
                      className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {confirmDeleteId === creator.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeactivate(creator.id)}
                          disabled={deletingId === creator.id}
                          className="rounded-lg bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          {deletingId === creator.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Confirm'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg bg-slate-200 px-2 py-1 text-xs text-text hover:bg-slate-300 dark:bg-slate-700 dark:text-text-dark dark:hover:bg-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(creator.id)}
                        className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500 dark:text-text-muted-dark dark:hover:bg-red-500/10"
                        title="Deactivate"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingId ? 'Edit Creator' : 'Add Creator'}
        size="xl"
      >
        <div className="space-y-4">
          {/* User search (only for create) */}
          {!editingId && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                Link to User Account
              </label>

              {selectedUser ? (
                <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 dark:bg-primary/10">
                  <UserAvatar
                    src={selectedUser.avatar_url}
                    name={selectedUser.display_name}
                    color={selectedUser.avatar_color}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text dark:text-text-dark">
                      {selectedUser.display_name}
                    </p>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark">
                      @{selectedUser.username}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null);
                      setForm((prev) => ({ ...prev, user_id: null }));
                    }}
                    className="rounded-lg p-1 text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
                    <input
                      type="text"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Search by username or email..."
                      className={cn(
                        'w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-text',
                        'placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                        'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark'
                      )}
                    />
                    {searchingUsers && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {userResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-border bg-surface shadow-lg dark:border-border-dark dark:bg-surface-dark">
                      {userResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => selectUser(user)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover dark:hover:bg-surface-hover-dark"
                        >
                          <UserAvatar
                            src={user.avatar_url}
                            name={user.display_name}
                            color={user.avatar_color}
                            size={28}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text dark:text-text-dark">
                              {user.display_name}
                            </p>
                            <p className="text-xs text-text-muted dark:text-text-muted-dark">
                              @{user.username}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Name */}
          <Input
            label="Creator Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Display name for this creator"
            required
          />

          {/* Bio */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Bio (optional)
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Short bio..."
              rows={2}
              className={cn(
                'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text transition-colors placeholder:text-text-muted',
                'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
                'resize-none'
              )}
            />
          </div>

          {/* Links */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Link 1"
              value={form.link_1}
              onChange={(e) => setForm((prev) => ({ ...prev, link_1: e.target.value }))}
              placeholder="https://..."
              type="url"
            />
            <Input
              label="Link 2"
              value={form.link_2}
              onChange={(e) => setForm((prev) => ({ ...prev, link_2: e.target.value }))}
              placeholder="https://..."
              type="url"
            />
            <Input
              label="Link 3"
              value={form.link_3}
              onChange={(e) => setForm((prev) => ({ ...prev, link_3: e.target.value }))}
              placeholder="https://..."
              type="url"
            />
          </div>

          {/* Languages */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Languages
            </label>
            <div className="flex gap-3">
              {AVAILABLE_LANGUAGES.map(({ code, label }) => (
                <label
                  key={code}
                  className="flex cursor-pointer items-center gap-2 text-sm text-text dark:text-text-dark"
                >
                  <input
                    type="checkbox"
                    checked={form.languages.includes(code)}
                    onChange={() => toggleLanguage(code)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary dark:border-border-dark"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Monthly Capacity */}
          <Input
            label="Monthly Capacity"
            value={String(form.monthly_capacity)}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                monthly_capacity: Math.max(1, parseInt(e.target.value, 10) || 1),
              }))
            }
            type="number"
            min={1}
            max={100}
          />

          {/* Mode flags */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Content Modes
            </label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-text dark:text-text-dark">
                <input
                  type="checkbox"
                  checked={form.can_bible}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, can_bible: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary dark:border-border-dark"
                />
                <BookOpen className="h-4 w-4 text-blue-600" /> Bible
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-text dark:text-text-dark">
                <input
                  type="checkbox"
                  checked={form.can_positivity}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      can_positivity: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary dark:border-border-dark"
                />
                <Sun className="h-4 w-4 text-amber-600" /> Positivity
              </label>
            </div>
          </div>

          {/* AI toggle */}
          <div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text dark:text-text-dark">
              <input
                type="checkbox"
                checked={form.is_ai}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, is_ai: e.target.checked }))
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary dark:border-border-dark"
              />
              <Bot className="h-4 w-4 text-purple-600" /> AI Creator (HeyGen)
            </label>

            {form.is_ai && (
              <div className="mt-2 ml-6">
                <Input
                  label="HeyGen Avatar ID"
                  value={form.heygen_avatar_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      heygen_avatar_id: e.target.value,
                    }))
                  }
                  placeholder="avatar_xxxx"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-border pt-4 dark:border-border-dark">
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingId ? (
                <>
                  <Check className="h-4 w-4" /> Save Changes
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Create Creator
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
