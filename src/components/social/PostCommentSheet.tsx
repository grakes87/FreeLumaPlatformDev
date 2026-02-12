'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PostCommentThread } from './PostCommentThread';

interface PostCommentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number;
  commentCount?: number;
  onCommentCountChange?: (delta: number) => void;
}

export function PostCommentSheet({
  isOpen,
  onClose,
  postId,
  commentCount,
  onCommentCountChange,
}: PostCommentSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [translateY, setTranslateY] = useState(0);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    setTranslateY(0);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Only start drag from the handle area or when scrolled to top
    const scrollContainer = sheetRef.current?.querySelector('[data-scroll]');
    if (scrollContainer && scrollContainer.scrollTop > 0 && !target.closest('[data-handle]')) {
      return;
    }
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const diff = e.touches[0].clientY - dragStartY.current;
    if (diff > 0) {
      setTranslateY(diff);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (translateY > 100) {
      onClose();
    }
    setTranslateY(0);
    dragStartY.current = null;
  }, [translateY, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet -- liquid glass */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-10 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-white/20 bg-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-transform"
        style={{
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: translateY > 0 ? 'none' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
      >
        {/* Drag handle */}
        <div data-handle className="flex justify-center pt-3 pb-1 cursor-grab">
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-lg font-semibold text-white">
            Comments{commentCount !== undefined ? ` (${commentCount})` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close comments"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <PostCommentThread
          postId={postId}
          onCommentCountChange={onCommentCountChange}
        />
      </div>
    </div>,
    document.body
  );
}
