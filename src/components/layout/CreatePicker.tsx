'use client';

import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { MessageSquare, Heart } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type CreateType = 'post' | 'prayer_request';

interface CreatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: CreateType) => void;
}

const OPTIONS: { type: CreateType; icon: React.ElementType; label: string; description: string }[] = [
  {
    type: 'post',
    icon: MessageSquare,
    label: 'Feed Post',
    description: 'Share with your community',
  },
  {
    type: 'prayer_request',
    icon: Heart,
    label: 'Prayer Request',
    description: 'Ask for prayer support',
  },
];

export function CreatePicker({ isOpen, onClose, onSelect }: CreatePickerProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine default highlight based on current route
  const defaultType: CreateType =
    pathname.startsWith('/prayer-wall') ? 'prayer_request' : 'post';

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleEscape]);

  const handleSelect = (type: CreateType) => {
    onSelect(type);
    onClose();
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Picker container - positioned above bottom nav */}
      <div
        ref={containerRef}
        className={cn(
          'fixed inset-x-0 bottom-20 z-10 mx-auto flex max-w-xs flex-col gap-2 rounded-2xl p-3',
          'border border-white/20 bg-white/90 shadow-xl backdrop-blur-xl',
          'dark:border-white/10 dark:bg-slate-900/90',
          'animate-in slide-in-from-bottom-4 fade-in duration-200'
        )}
        role="menu"
        aria-label="Create content"
      >
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const isDefault = option.type === defaultType;

          return (
            <button
              key={option.type}
              type="button"
              onClick={() => handleSelect(option.type)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors',
                isDefault
                  ? 'bg-primary/10 text-primary dark:bg-primary/20'
                  : 'text-text dark:text-text-dark hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
              role="menuitem"
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  isDefault
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-text-muted dark:bg-slate-800 dark:text-text-muted-dark'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-text-muted dark:text-text-muted-dark">
                  {option.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
