'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { loginSchema, type LoginInput } from '@/lib/utils/validation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginInput) => {
    setServerError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.error || 'Login failed');
        return;
      }

      login(result.user);
      toast.success('Welcome back!');
      router.push('/');
    } catch {
      setServerError('Something went wrong. Please try again.');
    }
  };

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('email')}
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          autoComplete="email"
          autoFocus
        />

        <Input
          {...register('password')}
          label="Password"
          type="password"
          placeholder="Enter your password"
          error={errors.password?.message}
          autoComplete="current-password"
        />

        {serverError && (
          <p className="text-sm text-red-500">{serverError}</p>
        )}

        <Button type="submit" fullWidth loading={isSubmitting}>
          Log In
        </Button>

        <div className="flex flex-col items-center gap-2 pt-2 text-sm">
          <Link
            href="/forgot-password"
            className="text-primary hover:text-primary-dark transition-colors"
          >
            Forgot password?
          </Link>
          <p className="text-text-muted dark:text-text-muted-dark">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-medium text-primary hover:text-primary-dark transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </Card>
  );
}
