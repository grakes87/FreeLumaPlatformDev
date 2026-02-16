'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface UserAvatarProps {
  src: string | null | undefined;
  name: string;
  color: string;
  size?: number;
  className?: string;
}

/**
 * Avatar that shows the user's photo when available, falling back to
 * InitialsAvatar when the URL is missing or the image fails to load.
 */
export function UserAvatar({ src, name, color, size = 48, className }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <InitialsAvatar name={name} color={color} size={size} className={className} />;
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className={cn('rounded-full object-cover', className)}
      style={{ width: size, height: size }}
    />
  );
}
