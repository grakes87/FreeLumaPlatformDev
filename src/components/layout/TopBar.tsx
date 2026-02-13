'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bell, MessageCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils/cn';
import { LANGUAGES, LANGUAGE_OPTIONS } from '@/lib/utils/constants';
import type { Language } from '@/lib/utils/constants';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { useNotificationBadge } from '@/components/notifications/useNotificationBadge';
import { useChatUnreadBadge } from '@/components/chat/useChatUnreadBadge';

interface TopBarProps {
  transparent?: boolean;
}

function getLanguageCookie(): Language {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/(?:^|; )preferred_language=([a-z]{2})/);
  const val = match?.[1];
  return (LANGUAGES as readonly string[]).includes(val ?? '') ? (val as Language) : 'en';
}

export function TopBar({ transparent = false }: TopBarProps) {
  const { resolvedTheme } = useTheme();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = useNotificationBadge();
  const hasUnreadMessages = useChatUnreadBadge();

  const logoSrc = transparent || resolvedTheme === 'dark'
    ? '/logo-white.png'
    : '/logo-black.png';

  const currentLang = typeof document !== 'undefined' ? getLanguageCookie() : 'en';
  const currentOption = LANGUAGE_OPTIONS.find((o) => o.code === currentLang) ?? LANGUAGE_OPTIONS[0];

  const handleSelectLanguage = useCallback((lang: Language) => {
    if (lang === currentLang) {
      setShowLangMenu(false);
      return;
    }
    document.cookie = `preferred_language=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ language: lang }),
    }).catch(() => {});
    window.location.reload();
  }, [currentLang]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showLangMenu && !showNotifications) return;
    const handleClick = (e: MouseEvent) => {
      if (showLangMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
      if (showNotifications && notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showLangMenu, showNotifications]);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between px-4',
        transparent
          ? 'bg-transparent'
          : 'border-b border-border bg-surface/90 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90'
      )}
    >
      {/* Left: App logo */}
      <Image
        src={logoSrc}
        alt="Free Luma"
        width={160}
        height={44}
        className="h-10 w-auto"
        priority
      />

      {/* Right: Chat + Language selector + Notification bell */}
      <div className="flex items-center gap-1">
        {/* Chat icon */}
        <Link
          href="/chat"
          className={cn(
            'relative rounded-lg p-2 transition-colors',
            transparent
              ? 'text-white/90 hover:text-white'
              : 'text-text hover:text-primary dark:text-text-dark dark:hover:text-primary'
          )}
          aria-label="Messages"
          onClick={() => { setShowLangMenu(false); setShowNotifications(false); }}
        >
          <MessageCircle className="h-6 w-6" />
          {/* Unread chat badge (red dot) */}
          {hasUnreadMessages && (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface dark:ring-surface-dark" />
          )}
        </Link>

        {/* Language selector */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => { setShowLangMenu((prev) => !prev); setShowNotifications(false); }}
            className={cn(
              'relative rounded-lg p-2 transition-colors',
              transparent
                ? 'text-white/90 hover:text-white'
                : 'text-text hover:text-primary dark:text-text-dark dark:hover:text-primary'
            )}
            aria-label="Change language"
            title="Change language"
          >
            <span className="text-lg leading-none">{currentOption.flag}</span>
          </button>

          {/* Dropdown menu -- liquid glass */}
          {showLangMenu && (
            <div
              className="absolute right-0 top-full mt-1 min-w-[160px] overflow-hidden rounded-2xl"
              style={{
                backdropFilter: 'blur(8px) saturate(160%)',
                WebkitBackdropFilter: 'blur(8px) saturate(160%)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              }}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleSelectLanguage(option.code)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                    option.code === currentLang
                      ? 'text-white font-medium'
                      : 'text-white/85 hover:text-white'
                  )}
                >
                  <span className="text-lg leading-none">{option.flag}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => { setShowNotifications((prev) => !prev); setShowLangMenu(false); }}
            className={cn(
              'relative rounded-lg p-2 transition-colors',
              transparent
                ? 'text-white/90 hover:text-white'
                : 'text-text hover:text-primary dark:text-text-dark dark:hover:text-primary'
            )}
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6" />
            {/* Unread badge (red dot) */}
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface dark:ring-surface-dark" />
            )}
          </button>

          {/* Notification dropdown */}
          <NotificationDropdown
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
          />
        </div>
      </div>
    </header>
  );
}
