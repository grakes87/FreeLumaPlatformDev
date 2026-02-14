'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

// ---- Email Change Schema ----

const changeEmailSchema = z.object({
  new_email: z.string().email('Please enter a valid email address'),
});

type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

// ---- Password Change Schema ----

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

// ---- Security Section ----

interface SecuritySectionProps {
  currentEmail: string;
  emailVerified: boolean;
}

export function SecuritySection({ currentEmail, emailVerified }: SecuritySectionProps) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  return (
    <div className="space-y-4">
      {/* Email Change */}
      <Card padding="sm" className="!p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Mail className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted dark:text-text-muted-dark">Email Address</p>
            <p className="text-sm font-medium text-text dark:text-text-dark truncate">
              {currentEmail}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {emailVerified ? (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                <Check className="h-3 w-3" />
                Verified
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <AlertCircle className="h-3 w-3" />
                Unverified
              </span>
            )}
          </div>
        </div>

        <div className="mx-4 border-t border-border dark:border-border-dark" />

        <button
          type="button"
          onClick={() => setShowEmailForm(!showEmailForm)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-sm font-medium text-primary">
            {showEmailForm ? 'Cancel' : 'Change Email'}
          </span>
        </button>

        {showEmailForm && (
          <EmailChangeForm
            currentEmail={currentEmail}
            onClose={() => setShowEmailForm(false)}
          />
        )}
      </Card>

      {/* Password Change */}
      <Card padding="sm" className="!p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPasswordForm(!showPasswordForm)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <Lock className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
          <span className="flex-1 text-sm font-medium text-text dark:text-text-dark">
            Change Password
          </span>
        </button>

        {showPasswordForm && (
          <PasswordChangeForm onClose={() => setShowPasswordForm(false)} />
        )}
      </Card>
    </div>
  );
}

// ---- Email Change Form ----

function EmailChangeForm({
  currentEmail,
  onClose,
}: {
  currentEmail: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { new_email: '' },
  });

  const onSubmit = async (data: ChangeEmailInput) => {
    setServerError('');
    setSuccessMessage('');

    if (data.new_email.toLowerCase().trim() === currentEmail.toLowerCase()) {
      setServerError('New email is the same as your current email.');
      return;
    }

    try {
      const res = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_email: data.new_email }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setServerError('This email address is already in use.');
        } else if (res.status === 429) {
          setServerError('Too many requests. Please try again later.');
        } else {
          setServerError(result.error || 'Failed to change email.');
        }
        return;
      }

      setSuccessMessage(`Verification email sent to ${data.new_email}. Check your inbox.`);
      reset();
    } catch {
      setServerError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="border-t border-border bg-slate-50/50 px-4 py-4 dark:border-border-dark dark:bg-slate-800/30">
      {successMessage ? (
        <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
          <p className="text-sm text-green-700 dark:text-green-300">
            {successMessage}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-xs font-medium text-primary"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input
            {...register('new_email')}
            type="email"
            label="New Email Address"
            placeholder="Enter new email"
            error={errors.new_email?.message}
            autoComplete="email"
          />

          {serverError && (
            <p className="text-xs text-red-500">{serverError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" loading={isSubmitting}>
              Send Verification
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
      )}
    </div>
  );
}

// ---- Password Change Form ----

function PasswordChangeForm({ onClose }: { onClose: () => void }) {
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
