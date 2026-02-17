'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import {
  signupCredentialsSchema,
  type SignupCredentialsInput,
} from '@/lib/utils/validation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ActivationCodeStep } from './ActivationCodeStep';
import { BookOpen, Sun } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { LANGUAGE_OPTIONS } from '@/lib/utils/constants';
import type { Language } from '@/lib/utils/constants';

type Step = 'activation' | 'credentials';
type Mode = 'bible' | 'positivity';

// ── i18n strings keyed by language ──────────────────────────────
const i18n: Record<Language, Record<string, string>> = {
  en: {
    createAccount: 'Create your account',
    chooseExperience: 'Choose your experience',
    faith: 'Faith',
    positivity: 'Positivity',
    preferredTranslation: 'Preferred translation',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    displayName: 'Display Name',
    displayNamePlaceholder: 'Your name',
    username: 'Username',
    usernamePlaceholder: 'username',
    password: 'Password',
    passwordPlaceholder: 'Create a password',
    confirmPassword: 'Confirm Password',
    confirmPasswordPlaceholder: 'Re-enter your password',
    passwordsDoNotMatch: 'Passwords do not match',
    dateOfBirth: 'Date of Birth',
    termsPrefix: 'I agree to the',
    termsOfService: 'Terms of Service',
    termsAnd: 'and',
    privacyPolicy: 'Privacy Policy',
    submitButton: 'Create Account',
    alreadyHaveAccount: 'Already have an account?',
    logIn: 'Log in',
    atLeast8: 'At least 8 characters',
    oneUppercase: 'One uppercase letter',
    oneLowercase: 'One lowercase letter',
    oneNumber: 'One number',
    language: 'Language',
  },
  es: {
    createAccount: 'Crea tu cuenta',
    chooseExperience: 'Elige tu experiencia',
    faith: 'Fe',
    positivity: 'Positividad',
    preferredTranslation: 'Traduccion preferida',
    email: 'Correo electronico',
    emailPlaceholder: 'tu@ejemplo.com',
    displayName: 'Nombre para mostrar',
    displayNamePlaceholder: 'Tu nombre',
    username: 'Usuario',
    usernamePlaceholder: 'usuario',
    password: 'Contrasena',
    passwordPlaceholder: 'Crea una contrasena',
    confirmPassword: 'Confirmar contrasena',
    confirmPasswordPlaceholder: 'Repite tu contrasena',
    passwordsDoNotMatch: 'Las contrasenas no coinciden',
    dateOfBirth: 'Fecha de nacimiento',
    termsPrefix: 'Acepto los',
    termsOfService: 'Terminos de servicio',
    termsAnd: 'y la',
    privacyPolicy: 'Politica de privacidad',
    submitButton: 'Crear cuenta',
    alreadyHaveAccount: 'Ya tienes una cuenta?',
    logIn: 'Iniciar sesion',
    atLeast8: 'Al menos 8 caracteres',
    oneUppercase: 'Una letra mayuscula',
    oneLowercase: 'Una letra minuscula',
    oneNumber: 'Un numero',
    language: 'Idioma',
  },
};

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<Step>('activation');
  const [activationCode, setActivationCode] = useState('');
  const [modeHint, setModeHint] = useState<string | null>(null);
  const urlMode = searchParams.get('mode');
  const [selectedMode, setSelectedMode] = useState<Mode>(urlMode === 'positivity' ? 'positivity' : 'bible');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [preferredTranslation, setPreferredTranslation] = useState('KJV');
  const [allTranslations, setAllTranslations] = useState<{ code: string; name: string; language: string }[]>([]);
  const [serverError, setServerError] = useState('');

  const t = i18n[selectedLanguage];

  // Fetch all Bible translations once
  useEffect(() => {
    if (allTranslations.length > 0) return;
    fetch('/api/bible-translations')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setAllTranslations(data); })
      .catch(() => {});
  }, [allTranslations.length]);

  // Filter translations by selected language
  const filteredTranslations = allTranslations.filter(
    (tr) => tr.language === selectedLanguage
  );

  // Reset preferred translation when language changes and current pick isn't available
  useEffect(() => {
    if (filteredTranslations.length > 0 && !filteredTranslations.some((tr) => tr.code === preferredTranslation)) {
      setPreferredTranslation(filteredTranslations[0].code);
    }
  }, [selectedLanguage, filteredTranslations, preferredTranslation]);

  const handleLanguageChange = useCallback((lang: Language) => {
    setSelectedLanguage(lang);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setError,
    clearErrors,
  } = useForm<SignupCredentialsInput>({
    resolver: zodResolver(signupCredentialsSchema),
    mode: 'onTouched',
    defaultValues: {
      email: '',
      password: '',
      confirm_password: '',
      display_name: '',
      username: '',
      date_of_birth: '',
      terms_accepted: false,
    },
  });

  const password = watch('password', '');
  const confirmPassword = watch('confirm_password', '');
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Manual password-match validation (zodResolver ignores register validate)
  useEffect(() => {
    if (!confirmTouched || !confirmPassword) return;
    if (confirmPassword !== password) {
      setError('confirm_password', { type: 'validate', message: t.passwordsDoNotMatch });
    } else {
      clearErrors('confirm_password');
    }
  }, [confirmPassword, password, confirmTouched, setError, clearErrors, t.passwordsDoNotMatch]);

  const passwordRequirements = [
    { label: t.atLeast8, met: password.length >= 8 },
    { label: t.oneUppercase, met: /[A-Z]/.test(password) },
    { label: t.oneLowercase, met: /[a-z]/.test(password) },
    { label: t.oneNumber, met: /[0-9]/.test(password) },
  ];

  const handleActivationValidated = (code: string, hint: string | null) => {
    setActivationCode(code);
    const resolvedHint = hint || searchParams.get('mode');
    setModeHint(resolvedHint);
    if (resolvedHint === 'positivity') setSelectedMode('positivity');
    setStep('credentials');
  };

  const onSubmit = async (data: SignupCredentialsInput) => {
    setServerError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          display_name: data.display_name,
          username: data.username,
          activation_code: activationCode,
          date_of_birth: data.date_of_birth,
          terms_accepted: data.terms_accepted,
          mode: selectedMode,
          preferred_translation: selectedMode === 'bible' ? preferredTranslation : undefined,
          language: selectedLanguage,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.error || 'Registration failed');
        return;
      }

      login(result.user, result.token);
      toast.success(selectedLanguage === 'es' ? 'Cuenta creada exitosamente!' : 'Account created successfully!');

      // Mode is auto-set during registration from activation code —
      // skip mode selection and go straight to profile onboarding
      router.push('/onboarding/profile');
    } catch {
      setServerError(selectedLanguage === 'es' ? 'Algo salio mal. Intentalo de nuevo.' : 'Something went wrong. Please try again.');
    }
  };

  if (step === 'activation') {
    return (
      <div className="space-y-4">
        <ActivationCodeStep onValidated={handleActivationValidated} />
        <p className="text-center text-sm text-text-muted dark:text-text-muted-dark">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary-dark transition-colors"
          >
            Log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Language selector — flag buttons at top */}
        <div className="flex items-center justify-center gap-2">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => handleLanguageChange(option.code)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm transition-all',
                selectedLanguage === option.code
                  ? 'border-primary bg-primary/10 font-medium text-primary dark:bg-primary/20'
                  : 'border-border text-text-muted hover:border-primary/40 dark:border-border-dark dark:text-text-muted-dark'
              )}
            >
              <span className="text-base leading-none">{option.flag}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        <h2 className="text-center text-xl font-semibold text-text dark:text-text-dark">
          {t.createAccount}
        </h2>

        {/* Mode selector */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
            {t.chooseExperience}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedMode('bible')}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-left transition-all',
                selectedMode === 'bible'
                  ? 'border-primary bg-primary/10 dark:bg-primary/20'
                  : 'border-border hover:border-primary/40 dark:border-border-dark'
              )}
            >
              <BookOpen className={cn('h-5 w-5 shrink-0', selectedMode === 'bible' ? 'text-primary' : 'text-text-muted dark:text-text-muted-dark')} />
              <span className={cn('text-sm font-medium', selectedMode === 'bible' ? 'text-primary' : 'text-text dark:text-text-dark')}>
                {t.faith}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMode('positivity')}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-left transition-all',
                selectedMode === 'positivity'
                  ? 'border-primary bg-primary/10 dark:bg-primary/20'
                  : 'border-border hover:border-primary/40 dark:border-border-dark'
              )}
            >
              <Sun className={cn('h-5 w-5 shrink-0', selectedMode === 'positivity' ? 'text-primary' : 'text-text-muted dark:text-text-muted-dark')} />
              <span className={cn('text-sm font-medium', selectedMode === 'positivity' ? 'text-primary' : 'text-text dark:text-text-dark')}>
                {t.positivity}
              </span>
            </button>
          </div>
        </div>

        {/* Bible translation selector — only for Faith mode */}
        {selectedMode === 'bible' && filteredTranslations.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              {t.preferredTranslation}
            </label>
            <select
              value={preferredTranslation}
              onChange={(e) => setPreferredTranslation(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text transition-colors focus:border-primary focus:ring-2 focus:ring-primary/50 focus:outline-none dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            >
              {filteredTranslations.map((tr) => (
                <option key={tr.code} value={tr.code}>
                  {tr.name} ({tr.code})
                </option>
              ))}
            </select>
          </div>
        )}

        <Input
          {...register('email')}
          label={t.email}
          type="email"
          placeholder={t.emailPlaceholder}
          error={errors.email?.message}
          autoComplete="email"
          autoFocus
        />

        <Input
          {...register('display_name')}
          label={t.displayName}
          placeholder={t.displayNamePlaceholder}
          error={errors.display_name?.message}
          autoComplete="name"
        />

        <div>
          <label
            htmlFor="username"
            className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark"
          >
            {t.username}
          </label>
          <div className="flex items-center rounded-xl border border-border bg-surface transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/50 dark:border-border-dark dark:bg-surface-dark">
            <span className="pl-4 text-text-muted dark:text-text-muted-dark">
              @
            </span>
            <input
              {...register('username')}
              id="username"
              placeholder={t.usernamePlaceholder}
              autoComplete="username"
              className="w-full rounded-xl bg-transparent px-2 py-3 text-text outline-none placeholder:text-text-muted dark:text-text-dark dark:placeholder:text-text-muted-dark"
            />
          </div>
          {errors.username?.message && (
            <p className="mt-1.5 text-sm text-red-500">
              {errors.username.message}
            </p>
          )}
        </div>

        <div>
          <Input
            {...register('password')}
            label={t.password}
            type="password"
            placeholder={t.passwordPlaceholder}
            error={errors.password?.message}
            autoComplete="new-password"
          />
          <div className="mt-2 space-y-1">
            {passwordRequirements.map((req) => (
              <div key={req.label} className="flex items-center gap-2 text-xs">
                <span
                  className={
                    req.met
                      ? 'text-green-500'
                      : 'text-text-muted dark:text-text-muted-dark'
                  }
                >
                  {req.met ? '\u2713' : '\u2022'}
                </span>
                <span
                  className={
                    req.met
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-text-muted dark:text-text-muted-dark'
                  }
                >
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Input
          {...(() => {
            const reg = register('confirm_password');
            return {
              ...reg,
              onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                reg.onBlur(e);
                setConfirmTouched(true);
              },
            };
          })()}
          label={t.confirmPassword}
          type="password"
          placeholder={t.confirmPasswordPlaceholder}
          error={errors.confirm_password?.message}
          autoComplete="new-password"
        />

        <Input
          {...register('date_of_birth')}
          label={t.dateOfBirth}
          type="date"
          error={errors.date_of_birth?.message}
        />

        <div className="flex items-start gap-3">
          <input
            {...register('terms_accepted')}
            type="checkbox"
            id="terms"
            className="mt-1 h-4 w-4 rounded border-border accent-primary"
          />
          <label
            htmlFor="terms"
            className="text-sm text-text-muted dark:text-text-muted-dark"
          >
            {t.termsPrefix}{' '}
            <Link href="/terms" className="text-primary hover:text-primary-dark">
              {t.termsOfService}
            </Link>{' '}
            {t.termsAnd}{' '}
            <Link href="/privacy" className="text-primary hover:text-primary-dark">
              {t.privacyPolicy}
            </Link>
          </label>
        </div>
        {errors.terms_accepted?.message && (
          <p className="text-sm text-red-500">{errors.terms_accepted.message}</p>
        )}

        {serverError && (
          <p className="text-sm text-red-500">{serverError}</p>
        )}

        <Button type="submit" fullWidth loading={isSubmitting}>
          {t.submitButton}
        </Button>

        <div className="flex flex-col items-center gap-2 pt-2 text-sm">
          <p className="text-text-muted dark:text-text-muted-dark">
            {t.alreadyHaveAccount}{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary-dark transition-colors"
            >
              {t.logIn}
            </Link>
          </p>
        </div>
      </form>
    </Card>
  );
}
