'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { AvatarUpload } from '@/components/profile/AvatarUpload';

const profileSchema = z.object({
  display_name: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(100, 'Display name must be at most 100 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-z0-9_]+$/,
      'Lowercase letters, numbers, and underscores only'
    ),
  bio: z
    .string()
    .max(150, 'Bio must be at most 150 characters')
    .optional()
    .or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function ProfileSetup() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.avatar_url ?? null
  );
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: user?.display_name || '',
      username: user?.username || '',
      bio: user?.bio || '',
    },
  });

  const watchedUsername = watch('username');
  const watchedBio = watch('bio');
  const bioLength = (watchedBio || '').length;

  // Debounced username availability check
  const checkUsername = useCallback(
    async (username: string) => {
      if (!username || username.length < 3) {
        setUsernameStatus('idle');
        return;
      }

      if (!/^[a-z0-9_]+$/.test(username)) {
        setUsernameStatus('invalid');
        return;
      }

      // If unchanged from current username, mark as available
      if (user?.username && username === user.username) {
        setUsernameStatus('available');
        return;
      }

      setUsernameStatus('checking');

      try {
        const res = await fetch(
          `/api/users/check-username?username=${encodeURIComponent(username)}`
        );
        const data = await res.json();
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    },
    [user?.username]
  );

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!watchedUsername || watchedUsername.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      checkUsername(watchedUsername);
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [watchedUsername, checkUsername]);

  const onSubmit = async (data: ProfileFormData) => {
    if (usernameStatus === 'taken') {
      toast.error('That username is already taken');
      return;
    }

    if (usernameStatus === 'checking') {
      toast.info('Checking username availability...');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        display_name: data.display_name,
        username: data.username,
      };

      if (data.bio) {
        payload.bio = data.bio;
      } else {
        payload.bio = null;
      }

      if (avatarUrl) {
        payload.avatar_url = avatarUrl;
      }

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const resData = await res.json();
        throw new Error(resData.error || 'Failed to save profile');
      }

      router.push('/onboarding/interests');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (url: string) => {
    setAvatarUrl(url);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Set Up Your Profile
        </h1>
        <p className="mt-2 text-text-muted dark:text-text-muted-dark">
          Tell us a bit about yourself
        </p>
      </div>

      {/* Avatar */}
      <div className="flex justify-center">
        <AvatarUpload
          currentAvatarUrl={avatarUrl}
          avatarColor={user?.avatar_color || '#62BEBA'}
          displayName={user?.display_name || 'User'}
          onAvatarChange={handleAvatarChange}
          size={96}
        />
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full flex-col gap-4"
      >
        {/* Display Name */}
        <Input
          label="Display Name"
          placeholder="Your name"
          error={errors.display_name?.message}
          {...register('display_name')}
        />

        {/* Username */}
        <div className="w-full">
          <label
            htmlFor="username"
            className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark"
          >
            Username
          </label>
          <div className="relative">
            <span className="absolute top-1/2 left-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark">
              @
            </span>
            <input
              id="username"
              placeholder="username"
              autoComplete="off"
              className={cn(
                'w-full rounded-xl border bg-surface py-3 pr-10 pl-8 text-text transition-colors placeholder:text-text-muted',
                'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
                errors.username
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50'
                  : 'border-border'
              )}
              {...register('username')}
            />
            {/* Status indicator */}
            <div className="absolute top-1/2 right-3 -translate-y-1/2">
              {usernameStatus === 'checking' && (
                <Loader2 className="h-4 w-4 animate-spin text-text-muted dark:text-text-muted-dark" />
              )}
              {usernameStatus === 'available' && (
                <Check className="h-4 w-4 text-green-500" />
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <X className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          {errors.username && (
            <p className="mt-1.5 text-sm text-red-500">
              {errors.username.message}
            </p>
          )}
          {usernameStatus === 'taken' && !errors.username && (
            <p className="mt-1.5 text-sm text-red-500">
              This username is already taken
            </p>
          )}
        </div>

        {/* Bio */}
        <div className="w-full">
          <label
            htmlFor="bio"
            className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark"
          >
            Bio{' '}
            <span className="font-normal text-text-muted dark:text-text-muted-dark">
              (optional)
            </span>
          </label>
          <textarea
            id="bio"
            rows={3}
            maxLength={150}
            placeholder="A short bio about yourself..."
            className={cn(
              'w-full resize-none rounded-xl border bg-surface px-4 py-3 text-text transition-colors placeholder:text-text-muted',
              'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
              'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
              errors.bio
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50'
                : 'border-border'
            )}
            {...register('bio')}
          />
          <p
            className={cn(
              'mt-1 text-right text-xs',
              bioLength > 140
                ? 'text-orange-500'
                : 'text-text-muted dark:text-text-muted-dark'
            )}
          >
            {bioLength}/150
          </p>
          {errors.bio && (
            <p className="mt-1 text-sm text-red-500">{errors.bio.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={usernameStatus === 'taken' || usernameStatus === 'checking'}
          loading={saving}
          fullWidth
          size="lg"
        >
          Continue
        </Button>
      </form>
    </div>
  );
}
