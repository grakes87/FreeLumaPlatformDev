'use client';

import { useMemo } from 'react';

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

/**
 * Full-screen gradient background with centered text for TikTok-mode text-only posts.
 */
export function TextPostGradient({ text, postId }: TextPostGradientProps) {
  const gradientClass = useMemo(() => {
    return GRADIENTS[postId % GRADIENTS.length];
  }, [postId]);

  return (
    <div
      className={`relative h-full w-full bg-gradient-to-br ${gradientClass}`}
    >
      {/* Text centered within visible viewport, not the full 100vh card */}
      <div className="flex items-center justify-center px-8 pr-16" style={{ height: '100svh' }}>
        <p
          className="max-w-md text-center text-2xl font-semibold leading-relaxed text-white sm:text-3xl"
          style={{
            textShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
