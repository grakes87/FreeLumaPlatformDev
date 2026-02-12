'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { AvatarUpload } from './AvatarUpload';

interface ProfileFormData {
  display_name: string;
  username: string;
  bio: string;
  profile_privacy: 'public' | 'private';
  date_of_birth: string;
  location: string;
  website: string;
  mode: 'bible' | 'positivity';
  denomination: string;
  church: string;
}

interface EditProfileFormProps {
  initialData: {
    id: number;
    display_name: string;
    username: string;
    bio: string | null;
    avatar_url: string | null;
    avatar_color: string;
    profile_privacy: 'public' | 'private';
    date_of_birth: string | null;
    location: string | null;
    website: string | null;
    mode: string;
    denomination: string | null;
    church: string | null;
  };
}

const BIO_MAX_LENGTH = 160;

/**
 * Full edit profile form with all fields per CONTEXT.md.
 * Includes debounced username availability check, bio char counter,
 * privacy toggle, and mode switch with confirmation.
 */
export function EditProfileForm({ initialData }: EditProfileFormProps) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState<ProfileFormData>({
    display_name: initialData.display_name,
    username: initialData.username,
    bio: initialData.bio || '',
    profile_privacy: initialData.profile_privacy,
    date_of_birth: initialData.date_of_birth || '',
    location: initialData.location || '',
    website: initialData.website || '',
    mode: initialData.mode as 'bible' | 'positivity',
    denomination: initialData.denomination || '',
    church: initialData.church || '',
  });

  const [saving, setSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [modeConfirmOpen, setModeConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<'bible' | 'positivity' | null>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalUsername = useRef(initialData.username);

  const updateField = <K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Debounced username check
  useEffect(() => {
    if (form.username === originalUsername.current) {
      setUsernameStatus('idle');
      return;
    }

    if (form.username.length < 3 || !/^[a-z0-9_]+$/.test(form.username)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');

    if (usernameTimerRef.current) {
      clearTimeout(usernameTimerRef.current);
    }

    usernameTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/check-username?username=${encodeURIComponent(form.username)}`,
          { credentials: 'include' }
        );

        if (res.ok) {
          const data = await res.json();
          setUsernameStatus(data.available ? 'available' : 'taken');
        } else {
          setUsernameStatus('idle');
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, 400);

    return () => {
      if (usernameTimerRef.current) {
        clearTimeout(usernameTimerRef.current);
      }
    };
  }, [form.username]);

  // Handle mode change with confirmation
  const handleModeChange = (newMode: 'bible' | 'positivity') => {
    if (newMode === form.mode) return;
    setPendingMode(newMode);
    setModeConfirmOpen(true);
  };

  const confirmModeChange = () => {
    if (pendingMode) {
      updateField('mode', pendingMode);
    }
    setModeConfirmOpen(false);
    setPendingMode(null);
  };

  const cancelModeChange = () => {
    setModeConfirmOpen(false);
    setPendingMode(null);
  };

  // Save profile
  const handleSave = useCallback(async () => {
    if (saving) return;

    // Validate
    if (!form.display_name.trim()) {
      toast.error('Display name is required');
      return;
    }

    if (form.username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }

    if (usernameStatus === 'taken') {
      toast.error('Username is already taken');
      return;
    }

    if (usernameStatus === 'invalid') {
      toast.error('Username can only contain lowercase letters, numbers, and underscores');
      return;
    }

    if (form.website && form.website.trim()) {
      try {
        new URL(form.website.startsWith('http') ? form.website : `https://${form.website}`);
      } catch {
        toast.error('Please enter a valid website URL');
        return;
      }
    }

    setSaving(true);

    try {
      // Build update payload for user profile fields
      const payload: Record<string, unknown> = {
        display_name: form.display_name.trim(),
        bio: form.bio.trim() || null,
        profile_privacy: form.profile_privacy,
        location: form.location.trim() || null,
        website: form.website.trim() || null,
        date_of_birth: form.date_of_birth || null,
        denomination: form.denomination.trim() || null,
        church: form.church.trim() || null,
      };

      // Only include username if changed
      if (form.username !== originalUsername.current) {
        payload.username = form.username;
      }

      // Update profile via PUT /api/users/me (or specific endpoint)
      const profileRes = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!profileRes.ok) {
        const err = await profileRes.json();
        throw new Error(err.error || 'Failed to update profile');
      }

      // Update mode separately via settings endpoint if changed
      if (form.mode !== initialData.mode) {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ mode: form.mode }),
        });
      }

      toast.success('Profile updated');
      await refreshUser();
      router.push('/profile');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [form, saving, usernameStatus, initialData.mode, toast, refreshUser, router]);

  const handleAvatarChange = () => {
    refreshUser();
  };

  return (
    <div className="mx-auto max-w-lg">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-1 text-text hover:bg-slate-100 dark:text-text-dark dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-text dark:text-text-dark">
          Edit Profile
        </h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || usernameStatus === 'taken' || usernameStatus === 'invalid'}
          className={cn(
            'rounded-xl px-4 py-1.5 text-sm font-medium transition-colors',
            'bg-primary text-white hover:bg-primary-dark',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </button>
      </div>

      <div className="space-y-6 px-4 py-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <AvatarUpload
            currentAvatarUrl={initialData.avatar_url}
            avatarColor={initialData.avatar_color}
            displayName={form.display_name || initialData.display_name}
            onAvatarChange={handleAvatarChange}
            size={96}
          />
        </div>

        {/* Display name */}
        <div>
          <label className="block text-sm font-medium text-text dark:text-text-dark mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => updateField('display_name', e.target.value)}
            maxLength={100}
            className={cn(
              'w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none',
              'focus:border-primary text-text dark:text-text-dark',
              'dark:border-border-dark dark:focus:border-primary'
            )}
          />
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-text dark:text-text-dark mb-1">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted dark:text-text-muted-dark">
              @
            </span>
            <input
              type="text"
              value={form.username}
              onChange={(e) => updateField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              maxLength={30}
              className={cn(
                'w-full rounded-xl border bg-transparent pl-7 pr-8 py-2.5 text-sm outline-none',
                'text-text dark:text-text-dark',
                usernameStatus === 'taken' || usernameStatus === 'invalid'
                  ? 'border-red-400 dark:border-red-600 focus:border-red-500'
                  : usernameStatus === 'available'
                    ? 'border-green-400 dark:border-green-600 focus:border-green-500'
                    : 'border-border dark:border-border-dark focus:border-primary'
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameStatus === 'checking' && (
                <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
              )}
              {usernameStatus === 'available' && (
                <Check className="h-4 w-4 text-green-500" />
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <X className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          {usernameStatus === 'taken' && (
            <p className="mt-1 text-xs text-red-500">Username is already taken</p>
          )}
          {usernameStatus === 'invalid' && (
            <p className="mt-1 text-xs text-red-500">
              Only lowercase letters, numbers, and underscores (min 3 chars)
            </p>
          )}
        </div>

        {/* Bio */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-text dark:text-text-dark">
              Bio
            </label>
            <span className={cn(
              'text-xs',
              form.bio.length > BIO_MAX_LENGTH
                ? 'text-red-500'
                : 'text-text-muted dark:text-text-muted-dark'
            )}>
              {form.bio.length}/{BIO_MAX_LENGTH}
            </span>
          </div>
          <textarea
            value={form.bio}
            onChange={(e) => updateField('bio', e.target.value.slice(0, BIO_MAX_LENGTH))}
            rows={3}
            maxLength={BIO_MAX_LENGTH}
            placeholder="Tell people about yourself..."
            className={cn(
              'w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none resize-none',
              'focus:border-primary text-text dark:text-text-dark',
              'dark:border-border-dark dark:focus:border-primary',
              'placeholder:text-text-muted dark:placeholder:text-text-muted-dark'
            )}
          />
        </div>

        {/* Privacy */}
        <div>
          <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">
            Profile Privacy
          </label>
          <div className="flex rounded-xl border border-border dark:border-border-dark overflow-hidden">
            <button
              type="button"
              onClick={() => updateField('profile_privacy', 'public')}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium transition-colors',
                form.profile_privacy === 'public'
                  ? 'bg-primary text-white'
                  : 'text-text-muted dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-slate-800/50'
              )}
            >
              Public
            </button>
            <button
              type="button"
              onClick={() => updateField('profile_privacy', 'private')}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium transition-colors border-l border-border dark:border-border-dark',
                form.profile_privacy === 'private'
                  ? 'bg-primary text-white'
                  : 'text-text-muted dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-slate-800/50'
              )}
            >
              Private
            </button>
          </div>
          <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
            {form.profile_privacy === 'private'
              ? 'Only followers can see your posts'
              : 'Anyone can see your posts'}
          </p>
        </div>

        {/* Date of birth */}
        <div>
          <label className="block text-sm font-medium text-text dark:text-text-dark mb-1">
            Date of Birth
          </label>
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => updateField('date_of_birth', e.target.value)}
            className={cn(
              'w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none',
              'focus:border-primary text-text dark:text-text-dark',
              'dark:border-border-dark dark:focus:border-primary'
            )}
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-text dark:text-text-dark mb-1">
            Location
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => updateField('location', e.target.value)}
            maxLength={200}
            placeholder="City, State"
            className={cn(
              'w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none',
              'focus:border-primary text-text dark:text-text-dark',
              'dark:border-border-dark dark:focus:border-primary',
              'placeholder:text-text-muted dark:placeholder:text-text-muted-dark'
            )}
          />
        </div>

        {/* Website */}
        <div>
          <label className="block text-sm font-medium text-text dark:text-text-dark mb-1">
            Website
          </label>
          <input
            type="url"
            value={form.website}
            onChange={(e) => updateField('website', e.target.value)}
            maxLength={500}
            placeholder="https://yoursite.com"
            className={cn(
              'w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none',
              'focus:border-primary text-text dark:text-text-dark',
              'dark:border-border-dark dark:focus:border-primary',
              'placeholder:text-text-muted dark:placeholder:text-text-muted-dark'
            )}
          />
        </div>

        {/* Account Mode */}
        <div>
          <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">
            Account Mode
          </label>
          <div className="flex rounded-xl border border-border dark:border-border-dark overflow-hidden">
            <button
              type="button"
              onClick={() => handleModeChange('bible')}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium transition-colors',
                form.mode === 'bible'
                  ? 'bg-primary text-white'
                  : 'text-text-muted dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-slate-800/50'
              )}
            >
              Bible
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('positivity')}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium transition-colors border-l border-border dark:border-border-dark',
                form.mode === 'positivity'
                  ? 'bg-primary text-white'
                  : 'text-text-muted dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-slate-800/50'
              )}
            >
              Positivity
            </button>
          </div>
          <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
            Affects your daily content and feed experience
          </p>
        </div>

        {/* Denomination (optional) */}
        <div>
          <label className="block text-sm font-medium text-text dark:text-text-dark mb-1">
            Denomination
            <span className="ml-1 text-xs text-text-muted dark:text-text-muted-dark">(optional)</span>
          </label>
          <input
            type="text"
            value={form.denomination}
            onChange={(e) => updateField('denomination', e.target.value)}
            maxLength={100}
            placeholder="e.g. Baptist, Catholic, Non-denominational"
            className={cn(
              'w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none',
              'focus:border-primary text-text dark:text-text-dark',
              'dark:border-border-dark dark:focus:border-primary',
              'placeholder:text-text-muted dark:placeholder:text-text-muted-dark'
            )}
          />
        </div>

        {/* Church (optional) */}
        <div>
          <label className="block text-sm font-medium text-text dark:text-text-dark mb-1">
            Church
            <span className="ml-1 text-xs text-text-muted dark:text-text-muted-dark">(optional)</span>
          </label>
          <input
            type="text"
            value={form.church}
            onChange={(e) => updateField('church', e.target.value)}
            maxLength={200}
            placeholder="Your church name"
            className={cn(
              'w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none',
              'focus:border-primary text-text dark:text-text-dark',
              'dark:border-border-dark dark:focus:border-primary',
              'placeholder:text-text-muted dark:placeholder:text-text-muted-dark'
            )}
          />
        </div>
      </div>

      {/* Mode change confirmation dialog */}
      {modeConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelModeChange} />
          <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl dark:bg-surface-dark">
            <h3 className="text-lg font-semibold text-text dark:text-text-dark">
              Change Account Mode?
            </h3>
            <p className="mt-2 text-sm text-text-muted dark:text-text-muted-dark">
              Switching to <strong>{pendingMode}</strong> mode will change your daily content
              and may affect your feed experience. Are you sure?
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={cancelModeChange}
                className={cn(
                  'flex-1 rounded-xl border border-border px-4 py-2 text-sm font-medium',
                  'text-text hover:bg-slate-50',
                  'dark:border-border-dark dark:text-text-dark dark:hover:bg-slate-800/50'
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModeChange}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Switch Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
