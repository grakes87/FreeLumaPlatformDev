'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <Card padding="lg">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-text dark:text-text-dark">
            Invalid Reset Link
          </h2>
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            Request New Reset Link
          </Link>
        </div>
      </Card>
    );
  }

  if (success) {
    return (
      <Card padding="lg">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg
              className="h-6 w-6 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-text dark:text-text-dark">
            Password Reset!
          </h2>
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            Your password has been reset successfully. Redirecting to login...
          </p>
        </div>
      </Card>
    );
  }

  const onSubmit = async (data: ResetPasswordInput) => {
    setServerError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.error || 'Something went wrong.');
        return;
      }

      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch {
      setServerError('Something went wrong. Please try again.');
    }
  };

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Free Luma</h1>
        <p className="mt-2 text-sm text-text-muted dark:text-text-muted-dark">
          Create a new password
        </p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            {...register('password')}
            label="New Password"
            type="password"
            placeholder="Enter your new password"
            error={errors.password?.message}
            autoComplete="new-password"
            autoFocus
          />

          <Input
            {...register('confirmPassword')}
            label="Confirm Password"
            type="password"
            placeholder="Confirm your new password"
            error={errors.confirmPassword?.message}
            autoComplete="new-password"
          />

          {serverError && (
            <p className="text-sm text-red-500">{serverError}</p>
          )}

          <Button type="submit" fullWidth loading={isSubmitting}>
            Reset Password
          </Button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-sm text-primary hover:text-primary-dark transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </Card>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
