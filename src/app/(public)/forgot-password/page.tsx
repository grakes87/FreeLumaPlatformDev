'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setServerError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const result = await res.json();
        setServerError(result.error || 'Something went wrong.');
        return;
      }

      setSubmitted(true);
    } catch {
      setServerError('Something went wrong. Please try again.');
    }
  };

  if (submitted) {
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-text dark:text-text-dark">
            Check your email
          </h2>
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            If an account exists with that email, we&apos;ve sent a password reset link.
            Check your inbox and spam folder.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Free Luma</h1>
        <p className="mt-2 text-sm text-text-muted dark:text-text-muted-dark">
          Reset your password
        </p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            Enter the email address associated with your account and we&apos;ll send you
            a link to reset your password.
          </p>

          <Input
            {...register('email')}
            label="Email"
            type="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            autoComplete="email"
            autoFocus
          />

          {serverError && (
            <p className="text-sm text-red-500">{serverError}</p>
          )}

          <Button type="submit" fullWidth loading={isSubmitting}>
            Send Reset Link
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
