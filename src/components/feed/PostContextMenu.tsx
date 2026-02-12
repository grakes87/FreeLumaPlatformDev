'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MoreHorizontal,
  Bookmark,
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
  isBookmarked?: boolean;
  onBookmark?: () => void;
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
  isBookmarked = false,
  onBookmark,
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
      label: isBookmarked ? 'Remove bookmark' : 'Bookmark',
      icon: Bookmark,
      onClick: () => { onBookmark?.(); handleClose(); },
      show: true,
    },
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
            ? 'text-white/80 hover:bg-white/10 hover:text-white'
            : 'text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800'
        )}
        aria-label="Post options"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-xl border py-1 shadow-lg',
            'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
          )}
        >
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
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30'
                    : 'text-text hover:bg-slate-50 dark:text-text-dark dark:hover:bg-slate-800/50'
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
