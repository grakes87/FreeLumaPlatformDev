'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MoreHorizontal,
  Flag,
  Ban,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PostContextMenuProps {
  postId: number;
  authorId: number;
  currentUserId: number | null;
  onReport?: () => void;
  onBlock?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Use light icon color for overlaid contexts (TikTok mode) */
  lightIcon?: boolean;
}

/**
 * Post context menu triggered by '...' button.
 * Shows dropdown with Bookmark, Report, Block (not own), Edit/Delete (own).
 * Closes on outside click.
 */
export function PostContextMenu({
  postId: _postId,
  authorId,
  currentUserId,
  onReport,
  onBlock,
  onEdit,
  onDelete,
  lightIcon = false,
}: PostContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwn = currentUserId !== null && currentUserId === authorId;

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    // Use requestAnimationFrame to avoid closing immediately from the same click
    requestAnimationFrame(() => {
      document.addEventListener('click', handleClickOutside);
    });

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, handleClose]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  const menuItems: Array<{
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    danger?: boolean;
    show: boolean;
  }> = [
    {
      label: 'Report',
      icon: Flag,
      onClick: () => { onReport?.(); handleClose(); },
      show: !isOwn,
    },
    {
      label: 'Block user',
      icon: Ban,
      onClick: () => { onBlock?.(); handleClose(); },
      danger: true,
      show: !isOwn,
    },
    {
      label: 'Edit',
      icon: Pencil,
      onClick: () => { onEdit?.(); handleClose(); },
      show: isOwn,
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: () => { onDelete?.(); handleClose(); },
      danger: true,
      show: isOwn,
    },
  ];

  const visibleItems = menuItems.filter((item) => item.show);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'rounded-full p-1.5 transition-colors',
          lightIcon
            ? 'text-white hover:bg-white/10'
            : 'text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800'
        )}
        aria-label="Post options"
      >
        <MoreHorizontal className={cn(lightIcon ? 'h-7 w-7' : 'h-5 w-5')} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-xl border border-white/20 bg-white/10 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors',
                  item.danger
                    ? 'text-red-400 hover:bg-white/10'
                    : 'text-white/90 hover:bg-white/10'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
