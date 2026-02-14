'use client';

import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { REACTION_TYPES, REACTION_EMOJI_MAP } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';

interface QuickReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: ReactionType) => void;
  anchorRect: DOMRect | null;
  /** Position the bar above (default) or to the left of the anchor */
  placement?: 'above' | 'left';
}

export function QuickReactionPicker({
  isOpen,
  onClose,
  onSelect,
  anchorRect,
  placement = 'above',
}: QuickReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    // Delay to avoid capturing the triggering event
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as EventListener);
    }, 10);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [isOpen, handleClickOutside]);

  if (!isOpen || !anchorRect) return null;
  if (typeof document === 'undefined') return null;

  const handleSelect = (type: ReactionType) => {
    onSelect(type);
    onClose();
  };

  const barWidth = 280;
  const barHeight = 46;
  const style: React.CSSProperties = { position: 'fixed', zIndex: 60 };

  if (placement === 'left') {
    // Position to the left of the anchor, vertically centered
    style.top = Math.max(8, anchorRect.top + anchorRect.height / 2 - barHeight / 2);
    // Right-align: anchor to the left edge of the button
    style.right = Math.max(8, window.innerWidth - anchorRect.left + 8);
  } else {
    // Center the bar above the anchor element
    style.bottom = window.innerHeight - anchorRect.top + 12;
    style.left = Math.max(8, Math.min(
      anchorRect.left + anchorRect.width / 2 - barWidth / 2,
      window.innerWidth - barWidth - 8
    ));
  }

  return createPortal(
    <div ref={pickerRef} style={style}>
      <div className="flex gap-0.5 rounded-full bg-white px-2 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
        {REACTION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleSelect(type)}
            className="rounded-full p-1 text-[26px] leading-none transition-transform hover:-translate-y-1 hover:scale-125 active:scale-90"
          >
            {REACTION_EMOJI_MAP[type]}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
