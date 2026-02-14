'use client';

import { cn } from '@/lib/utils/cn';

export interface InitialsAvatarProps {
  /** User's display name to extract initials from */
  name: string;
  /** Hex color assigned at signup (permanent) */
  color: string;
  /** Size in pixels (default 48) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Circular avatar showing the user's initials on a colored background.
 * Used as the default avatar when no photo is uploaded.
 */
export function InitialsAvatar({
  name,
  color,
  size = 48,
  className,
}: InitialsAvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold text-white select-none',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.4,
        lineHeight: 1,
      }}
      aria-label={`Avatar for ${name}`}
    >
      {initials || '?'}
    </div>
  );
}

/**
 * Curated palette of avatar background colors.
 * A random color is assigned at signup and stored permanently.
 */
export const AVATAR_COLORS = [
  '#62BEBA', // Teal
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
];

/**
 * Pick a random avatar color from the curated palette.
 */
export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
