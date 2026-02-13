'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserMinus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { OnlineStatusDot } from '@/components/chat/OnlineStatusDot';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Participant {
  id: number;
  user_id: number;
  role: 'member' | 'admin';
  user: {
    id: number;
    username: string;
    display_name: string;
    avatar_url: string | null;
    avatar_color: string;
    is_verified: boolean;
  };
}

interface GroupInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
  conversationName: string | null;
  conversationAvatarUrl: string | null;
  creatorId: number | null;
  currentUserId: number;
  participants: Participant[];
  isOnline: (userId: number) => boolean;
  onGroupUpdated: () => void;
}

const MAX_NAME_LENGTH = 100;

/**
 * Group info sheet: shows group details, member list, admin controls.
 * Creator can edit name, change photo, add/remove members.
 * Any member can leave the group.
 */
export function GroupInfoSheet({
  isOpen,
  onClose,
  conversationId,
  conversationName,
  conversationAvatarUrl,
  creatorId,
  currentUserId,
  participants,
  isOnline,
  onGroupUpdated,
}: GroupInfoSheetProps) {
  const router = useRouter();
  const isAdmin = creatorId === currentUserId;
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(conversationName || '');
  const [savingName, setSavingName] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sync name value when prop changes
  useEffect(() => {
    setNameValue(conversationName || '');
  }, [conversationName]);

  // Focus name input when editing
  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  // Save group name
  const handleSaveName = useCallback(async () => {
    if (!nameValue.trim() || nameValue.trim() === conversationName) {
      setEditingName(false);
      return;
    }

    try {
      setSavingName(true);
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      if (res.ok) {
        setEditingName(false);
        onGroupUpdated();
      }
    } catch {
      // Revert
      setNameValue(conversationName || '');
    } finally {
      setSavingName(false);
    }
  }, [nameValue, conversationName, conversationId, onGroupUpdated]);

  // Handle group photo upload
  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        setUploadingPhoto(true);
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/upload/chat-media', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          // Update conversation avatar
          await fetch(`/api/chat/conversations/${conversationId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ avatar_url: data.public_url }),
          });
          onGroupUpdated();
        }
      } catch (err) {
        console.error('[GroupInfoSheet] photo upload error:', err);
      } finally {
        setUploadingPhoto(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [conversationId, onGroupUpdated]
  );

  // Remove member
  const handleRemoveMember = useCallback(
    async (userId: number) => {
      try {
        setRemovingUserId(userId);
        const res = await fetch(`/api/chat/conversations/${conversationId}/participants`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ user_id: userId }),
        });
        if (res.ok) {
          onGroupUpdated();
        }
      } catch (err) {
        console.error('[GroupInfoSheet] remove member error:', err);
      } finally {
        setRemovingUserId(null);
        setConfirmRemoveId(null);
      }
    },
    [conversationId, onGroupUpdated]
  );

  // Leave group
  const handleLeaveGroup = useCallback(async () => {
    try {
      setLeavingGroup(true);
      const res = await fetch(`/api/chat/conversations/${conversationId}/participants`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: currentUserId }),
      });
      if (res.ok) {
        onClose();
        router.push('/chat');
      }
    } catch (err) {
      console.error('[GroupInfoSheet] leave group error:', err);
    } finally {
      setLeavingGroup(false);
    }
  }, [conversationId, currentUserId, router, onClose]);

  if (!isOpen) return null;

  const memberCount = participants.filter((p) => p.user_id !== currentUserId).length + 1;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 dark:border-white/10 px-4">
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          aria-label="Close"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="flex-1 text-lg font-semibold text-gray-900 dark:text-white">
          Group Info
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group avatar + name */}
        <div className="flex flex-col items-center border-b border-gray-200 dark:border-white/10 px-6 py-6">
          {/* Avatar */}
          <div className="relative mb-3">
            {conversationAvatarUrl ? (
              <img
                src={conversationAvatarUrl}
                alt={conversationName || 'Group'}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
                <span className="text-2xl font-bold text-primary">
                  {(conversationName || 'G').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow hover:bg-primary/90"
                aria-label="Change group photo"
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          {/* Name (editable by admin) */}
          {editingName ? (
            <div className="flex w-full max-w-xs items-center gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value.slice(0, MAX_NAME_LENGTH))}
                maxLength={MAX_NAME_LENGTH}
                className={cn(
                  'flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800',
                  'px-3 py-1.5 text-center text-sm text-gray-900 dark:text-white',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setNameValue(conversationName || '');
                    setEditingName(false);
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={savingName}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
              >
                {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {conversationName || 'Group Chat'}
              </h3>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="p-1 text-gray-400 hover:text-primary"
                  aria-label="Edit group name"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Members section */}
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Members
            </h4>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAddMembers(true)}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            )}
          </div>

          {/* Member list */}
          <div className="space-y-0.5">
            {/* Current user first (You) */}
            {participants
              .filter((p) => p.user_id === currentUserId)
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                >
                  <div className="relative shrink-0">
                    {p.user.avatar_url ? (
                      <img
                        src={p.user.avatar_url}
                        alt={p.user.display_name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <InitialsAvatar
                        name={p.user.display_name}
                        color={p.user.avatar_color}
                        size={40}
                      />
                    )}
                    <OnlineStatusDot isOnline size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        You
                      </span>
                      {p.role === 'admin' && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Admin
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      @{p.user.username}
                    </span>
                  </div>
                </div>
              ))}

            {/* Other members */}
            {participants
              .filter((p) => p.user_id !== currentUserId)
              .map((p) => (
                <div
                  key={p.id}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/profile/${p.user.username}`)}
                    className="relative shrink-0"
                  >
                    {p.user.avatar_url ? (
                      <img
                        src={p.user.avatar_url}
                        alt={p.user.display_name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <InitialsAvatar
                        name={p.user.display_name}
                        color={p.user.avatar_color}
                        size={40}
                      />
                    )}
                    <OnlineStatusDot isOnline={isOnline(p.user_id)} size="sm" />
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/profile/${p.user.username}`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {p.user.display_name}
                      </span>
                      {p.role === 'admin' && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Admin
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      @{p.user.username}
                    </span>
                  </button>

                  {/* Admin remove button */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(p.user_id)}
                      disabled={removingUserId === p.user_id}
                      className="shrink-0 rounded-full p-2 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      aria-label={`Remove ${p.user.display_name}`}
                    >
                      {removingUserId === p.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserMinus className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Leave group button */}
        <div className="border-t border-gray-200 dark:border-white/10 px-4 py-4">
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            disabled={leavingGroup}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-500/20"
          >
            {leavingGroup ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Leave Group
          </button>
        </div>
      </div>

      {/* Add members sub-flow */}
      {showAddMembers && (
        <AddMembersOverlay
          conversationId={conversationId}
          existingParticipantIds={participants.map((p) => p.user_id)}
          onClose={() => setShowAddMembers(false)}
          onMemberAdded={onGroupUpdated}
        />
      )}

      {/* Confirm remove member */}
      <ConfirmDialog
        isOpen={confirmRemoveId !== null}
        onClose={() => setConfirmRemoveId(null)}
        onConfirm={() => {
          if (confirmRemoveId !== null) handleRemoveMember(confirmRemoveId);
        }}
        title="Remove Member"
        message="Are you sure you want to remove this member from the group?"
        confirmLabel="Remove"
        danger
      />

      {/* Confirm leave group */}
      <ConfirmDialog
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={handleLeaveGroup}
        title="Leave Group"
        message="Are you sure you want to leave this group? You will no longer receive messages from this group."
        confirmLabel="Leave"
        danger
      />
    </div>,
    document.body
  );
}

// ---- Add Members Sub-overlay ----

interface AddMembersOverlayProps {
  conversationId: number;
  existingParticipantIds: number[];
  onClose: () => void;
  onMemberAdded: () => void;
}

function AddMembersOverlay({
  conversationId,
  existingParticipantIds,
  onClose,
  onMemberAdded,
}: AddMembersOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{
    id: number;
    display_name: string;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Search followers
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const searchTerm = query.length >= 2 ? query : '';
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchTerm)}&followers_only=true&limit=50`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          // Filter out existing participants
          const filtered = (data.users ?? []).filter(
            (u: { id: number }) => !existingParticipantIds.includes(u.id)
          );
          setResults(filtered);
        }
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, existingParticipantIds]);

  const handleAdd = useCallback(
    async (userId: number) => {
      try {
        setAddingId(userId);
        const res = await fetch(`/api/chat/conversations/${conversationId}/participants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ user_id: userId }),
        });
        if (res.ok) {
          // Remove from results
          setResults((prev) => prev.filter((u) => u.id !== userId));
          onMemberAdded();
        }
      } catch (err) {
        console.error('[AddMembers] add error:', err);
      } finally {
        setAddingId(null);
      }
    },
    [conversationId, onMemberAdded]
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 dark:border-white/10 px-4">
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          aria-label="Close"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="flex-1 text-lg font-semibold text-gray-900 dark:text-white">
          Add Members
        </h2>
      </div>

      {/* Search */}
      <div className="border-b border-gray-200 dark:border-white/10 px-4 py-2">
        <div className="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search followers..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No followers to add
          </div>
        )}

        {!loading &&
          results.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="shrink-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.display_name}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <InitialsAvatar
                    name={user.display_name}
                    color={user.avatar_color}
                    size={44}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {user.display_name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  @{user.username}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAdd(user.id)}
                disabled={addingId === user.id}
                className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {addingId === user.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Add'
                )}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
