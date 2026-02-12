'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  Lock,
  Eye,
  EyeOff,
  BookOpen,
  Sparkles,
  Globe,
  Bell,
  Clock,
  Info,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { TRANSLATIONS, LANGUAGES, MODES } from '@/lib/utils/constants';

// ---- Types ----

interface Settings {
  dark_mode: 'light' | 'dark' | 'system';
  push_enabled: boolean;
  email_notifications: boolean;
  daily_reminder_time: string;
  mode: 'bible' | 'positivity';
  language: 'en' | 'es';
  preferred_translation: string;
  timezone: string;
  email: string;
  email_verified: boolean;
}

// ---- Change Password Schema ----

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---- Theme Options ----

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

// ---- Mode Labels ----

const MODE_CONFIG = {
  bible: { label: 'Bible', description: 'Daily verses and faith content', icon: BookOpen },
  positivity: { label: 'Positivity', description: 'Daily quotes and inspiration', icon: Sparkles },
} as const;

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
};

// ---- Component ----

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const router = useRouter();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showModeConfirm, setShowModeConfirm] = useState<'bible' | 'positivity' | null>(null);
  const [mounted, setMounted] = useState(false);

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings);
        }
      } catch {
        toast.error('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save settings helper (debounced)
  const saveSettings = useCallback(
    (updates: Partial<Settings>) => {
      // Optimistic update
      setSettings((prev) => (prev ? { ...prev, ...updates } : prev));

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updates),
          });

          if (res.ok) {
            toast.success('Saved');
            // Refresh user context to propagate mode/language changes
            await refreshUser();
          } else {
            const data = await res.json();
            toast.error(data.error || 'Failed to save.');
          }
        } catch {
          toast.error('Failed to save settings.');
        }
      }, 500);
    },
    [refreshUser, toast]
  );

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  const handleModeSwitch = (newMode: 'bible' | 'positivity') => {
    if (settings?.mode === newMode) return;
    setShowModeConfirm(newMode);
  };

  const confirmModeSwitch = () => {
    if (showModeConfirm) {
      saveSettings({ mode: showModeConfirm });
      setShowModeConfirm(null);
    }
  };

  if (!user || loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="rounded-lg p-1.5 text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800 transition-colors"
          aria-label="Back to profile"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-text dark:text-text-dark">
          Settings
        </h1>
      </div>

      {/* ---- Account Section ---- */}
      <SectionHeader title="Account" />
      <Card padding="sm" className="mb-6 !p-0 overflow-hidden">
        {/* Email */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted dark:text-text-muted-dark">Email</p>
            <p className="text-sm font-medium text-text dark:text-text-dark truncate">
              {settings?.email || user.email}
            </p>
          </div>
          {settings?.email_verified ? (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              Verified
            </span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Unverified
            </span>
          )}
        </div>

        <Divider />

        {/* Change Password */}
        <button
          type="button"
          onClick={() => setShowChangePassword(!showChangePassword)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <Lock className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
          <span className="flex-1 text-sm font-medium text-text dark:text-text-dark">
            Change Password
          </span>
        </button>

        {showChangePassword && (
          <ChangePasswordForm onClose={() => setShowChangePassword(false)} />
        )}
      </Card>

      {/* ---- Appearance Section ---- */}
      <SectionHeader title="Appearance" />
      <Card padding="sm" className="mb-6 !p-0 overflow-hidden">
        <div className="px-4 py-3.5">
          <p className="text-sm font-medium text-text dark:text-text-dark mb-3">
            Theme
          </p>
          {mounted && (
            <div className="flex gap-2">
              {THEME_OPTIONS.map((option) => {
                const ThemeIcon = option.icon;
                const isActive = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setTheme(option.value);
                      saveSettings({ dark_mode: option.value as 'light' | 'dark' | 'system' });
                    }}
                    className={cn(
                      'flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2.5 text-xs transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-700'
                    )}
                  >
                    <ThemeIcon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* ---- Content Preferences Section ---- */}
      <SectionHeader title="Content Preferences" />
      <Card padding="sm" className="mb-6 !p-0 overflow-hidden">
        {/* Mode Toggle */}
        <div className="px-4 py-3.5">
          <p className="text-sm font-medium text-text dark:text-text-dark mb-3">
            Mode
          </p>
          <div className="flex gap-2">
            {MODES.map((m) => {
              const config = MODE_CONFIG[m];
              const ModeIcon = config.icon;
              const isActive = settings?.mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModeSwitch(m)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1.5 rounded-lg py-3 text-xs transition-colors border',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-transparent text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-700'
                  )}
                >
                  <ModeIcon className="h-5 w-5" />
                  <span className="font-medium">{config.label}</span>
                  <span className="text-[10px] opacity-70">{config.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode confirmation overlay */}
        {showModeConfirm && (
          <div className="mx-4 mb-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
            <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
              Switch to {MODE_CONFIG[showModeConfirm].label}? This changes your daily content.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmModeSwitch}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-dark transition-colors"
              >
                Switch
              </button>
              <button
                type="button"
                onClick={() => setShowModeConfirm(null)}
                className="rounded-md px-3 py-1 text-xs font-medium text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <Divider />

        {/* Bible Translation (only show for bible mode) */}
        {settings?.mode === 'bible' && (
          <>
            <div className="flex items-center justify-between px-4 py-3.5">
              <p className="text-sm font-medium text-text dark:text-text-dark">
                Default Translation
              </p>
              <select
                value={settings.preferred_translation}
                onChange={(e) => saveSettings({ preferred_translation: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-text dark:border-border-dark dark:bg-background-dark dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {TRANSLATIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <Divider />
          </>
        )}

        {/* Language */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
            <p className="text-sm font-medium text-text dark:text-text-dark">
              Language
            </p>
          </div>
          <div className="flex rounded-lg border border-border dark:border-border-dark overflow-hidden">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => saveSettings({ language: lang })}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  settings?.language === lang
                    ? 'bg-primary text-white'
                    : 'bg-background text-text-muted hover:bg-slate-100 dark:bg-background-dark dark:text-text-muted-dark dark:hover:bg-slate-700'
                )}
              >
                {LANGUAGE_LABELS[lang] || lang}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ---- Notifications Section ---- */}
      <SectionHeader title="Notifications" />
      <Card padding="sm" className="mb-6 !p-0 overflow-hidden">
        {/* Push Notifications */}
        <ToggleRow
          icon={Bell}
          label="Push Notifications"
          checked={settings?.push_enabled ?? true}
          onChange={(val) => saveSettings({ push_enabled: val })}
        />

        <Divider />

        {/* Email Notifications */}
        <ToggleRow
          icon={Bell}
          label="Email Notifications"
          checked={settings?.email_notifications ?? true}
          onChange={(val) => saveSettings({ email_notifications: val })}
        />

        <Divider />

        {/* Daily Reminder Time */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
            <p className="text-sm font-medium text-text dark:text-text-dark">
              Daily Reminder
            </p>
          </div>
          <input
            type="time"
            value={settings?.daily_reminder_time || '08:00'}
            onChange={(e) => saveSettings({ daily_reminder_time: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-text dark:border-border-dark dark:bg-background-dark dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <Divider />

        {/* Quiet Hours - disabled coming soon */}
        <div className="flex items-center justify-between px-4 py-3.5 opacity-50">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
            <div>
              <p className="text-sm font-medium text-text dark:text-text-dark">
                Quiet Hours
              </p>
              <p className="text-[10px] text-text-muted dark:text-text-muted-dark">
                Coming soon
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ---- About Section ---- */}
      <SectionHeader title="About" />
      <Card padding="sm" className="mb-6 !p-0 overflow-hidden">
        {/* Log Out */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
            'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10',
            loggingOut && 'opacity-60 pointer-events-none'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            {loggingOut ? 'Logging out...' : 'Log Out'}
          </span>
        </button>

        <Divider />

        {/* App Info */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Info className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
          <div className="flex-1">
            <p className="text-sm text-text-muted dark:text-text-muted-dark">
              Free Luma v1.0.0
            </p>
          </div>
        </div>

        <Divider />

        {/* Legal Links */}
        <a
          href="/terms"
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-sm text-text-muted dark:text-text-muted-dark">
            Terms of Service
          </span>
        </a>

        <Divider />

        <a
          href="/privacy"
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-sm text-text-muted dark:text-text-muted-dark">
            Privacy Policy
          </span>
        </a>
      </Card>
    </div>
  );
}

// ---- Sub-components ----

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
      {title}
    </h3>
  );
}

function Divider() {
  return <div className="mx-4 border-t border-border dark:border-border-dark" />;
}

function ToggleRow({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
        <p className="text-sm font-medium text-text dark:text-text-dark">
          {label}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
          checked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0.5',
            'mt-0.5'
          )}
        />
      </button>
    </div>
  );
}

function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  const onSubmit = async (data: ChangePasswordInput) => {
    setServerError('');

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_password: data.current_password,
          new_password: data.new_password,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.error || 'Failed to change password.');
        return;
      }

      toast.success('Password changed successfully.');
      reset();
      onClose();
    } catch {
      setServerError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="border-t border-border bg-slate-50/50 px-4 py-4 dark:border-border-dark dark:bg-slate-800/30">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="relative">
          <Input
            {...register('current_password')}
            type={showCurrent ? 'text' : 'password'}
            label="Current Password"
            placeholder="Enter current password"
            error={errors.current_password?.message}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-8 text-text-muted dark:text-text-muted-dark"
            tabIndex={-1}
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="relative">
          <Input
            {...register('new_password')}
            type={showNew ? 'text' : 'password'}
            label="New Password"
            placeholder="Enter new password"
            error={errors.new_password?.message}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-8 text-text-muted dark:text-text-muted-dark"
            tabIndex={-1}
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <Input
          {...register('confirm_password')}
          type="password"
          label="Confirm New Password"
          placeholder="Confirm new password"
          error={errors.confirm_password?.message}
          autoComplete="new-password"
        />

        {serverError && (
          <p className="text-xs text-red-500">{serverError}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" loading={isSubmitting}>
            Update Password
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
