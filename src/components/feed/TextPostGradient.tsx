'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TextPostGradientProps {
  text: string;
  /** Post ID used for deterministic gradient selection */
  postId: number;
}

/**
 * Predefined gradient backgrounds for text-only posts in TikTok mode.
 * Gradient is deterministic per post ID so it doesn't change on re-render.
 */
const GRADIENTS = [
  'from-teal-900 via-teal-800 to-cyan-900',             // deep teal
  'from-purple-900 via-violet-800 to-fuchsia-900',      // purple -> fuchsia
  'from-orange-600 via-red-600 to-pink-700',             // sunset
  'from-emerald-800 via-green-700 to-teal-800',          // forest green
  'from-amber-600 via-orange-600 to-red-600',            // warm orange
  'from-slate-900 via-teal-900 to-cyan-900',             // midnight teal
  'from-rose-700 via-pink-600 to-purple-700',            // rose
  'from-cyan-700 via-teal-700 to-blue-800',              // ocean
  'from-teal-800 via-cyan-700 to-blue-800',              // teal blue
  'from-red-800 via-rose-700 to-pink-800',               // crimson
];

/** Font size tiers — only reduces from the current max (text-2xl sm:text-3xl) */
function getFontClass(length: number): string {
  if (length < 100) return 'text-2xl sm:text-3xl';
  if (length < 300) return 'text-xl sm:text-2xl';
  if (length < 600) return 'text-lg sm:text-xl';
  return 'text-base sm:text-lg';
}

/** Line clamp values scaled per font tier to maximize visible text */
function getClampClass(length: number): string {
  if (length < 100) return 'line-clamp-[10]';
  if (length < 300) return 'line-clamp-[12]';
  if (length < 600) return 'line-clamp-[14]';
  return 'line-clamp-[16]';
}

/**
 * Full-screen gradient background with centered text for TikTok-mode text-only posts.
 * Long text is auto-scaled, clamped, and shows "Read more" to open a scrollable overlay.
 */
export function TextPostGradient({ text, postId }: TextPostGradientProps) {
  const [showFull, setShowFull] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  const gradientClass = useMemo(() => GRADIENTS[postId % GRADIENTS.length], [postId]);
  const fontClass = useMemo(() => getFontClass(text.length), [text.length]);
  const clampClass = useMemo(() => getClampClass(text.length), [text.length]);

  // Detect if line-clamp actually truncated the text
  useEffect(() => {
    const el = textRef.current;
    if (el) {
      setIsTruncated(el.scrollHeight > el.clientHeight + 2);
    }
  }, [text, fontClass, clampClass]);

  // Empty text (repost gradient-only background)
  if (!text) {
    return <div className={`relative h-full w-full bg-gradient-to-br ${gradientClass}`} />;
  }

  return (
    <div className={`relative h-full w-full bg-gradient-to-br ${gradientClass}`}>
      {/* Text centered within visible viewport, padded to clear top bar and bottom nav/author */}
      <div
        className="flex flex-col items-center justify-center px-8 pr-16 pt-16 pb-32"
        style={{ height: '100svh' }}
      >
        <p
          ref={textRef}
          className={cn(
            'max-w-md text-center font-semibold leading-relaxed text-white',
            fontClass,
            clampClass
          )}
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
        >
          {text}
        </p>
        {isTruncated && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFull(true);
            }}
            className="mt-3 text-sm font-bold text-white/70 drop-shadow-md active:text-white"
          >
            Read more
          </button>
        )}
      </div>

      {/* Full-text scrollable overlay via portal (outside snap-scroll container) */}
      {showFull && typeof document !== 'undefined' && createPortal(
        <div className={cn('fixed inset-0 z-[60] flex flex-col bg-gradient-to-br', gradientClass)}>
          {/* Darken the gradient for readability */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Close button */}
          <div className="relative z-10 flex items-center justify-end px-4 pt-14 pb-2">
            <button
              type="button"
              onClick={() => setShowFull(false)}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm active:bg-white/25"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>

          {/* Scrollable full text */}
          <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-8 pb-24">
            <p
              className={cn(
                'mx-auto max-w-lg text-center font-semibold leading-relaxed text-white whitespace-pre-wrap break-words',
                fontClass
              )}
              style={{ textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}
            >
              {text}
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
