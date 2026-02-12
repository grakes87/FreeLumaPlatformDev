'use client';

import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';
import type { UserData } from '@/context/AuthContext';
import { AvatarUpload } from './AvatarUpload';

export interface ProfileCardProps {
  /** User data from AuthContext */
  user: UserData;
  /** Called when avatar is changed (to refresh user data) */
  onAvatarChange?: (url: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Profile card displaying the user's avatar, name, username, and bio.
 * Clean, minimal design per CONTEXT.md: "No badges or mode indicators on profile card".
 */
export function ProfileCard({
  user,
  onAvatarChange,
  className,
}: ProfileCardProps) {
  return (
    <Card
      padding="lg"
      className={cn('flex flex-col items-center text-center', className)}
    >
      {/* Avatar with upload capability */}
      <AvatarUpload
        currentAvatarUrl={user.avatar_url}
        avatarColor={user.avatar_color}
        displayName={user.display_name}
        onAvatarChange={onAvatarChange ?? (() => {})}
        size={96}
      />

      {/* Display name */}
      <h2 className="mt-4 text-xl font-bold text-text dark:text-text-dark">
        {user.display_name}
      </h2>

      {/* Username */}
      <p className="mt-0.5 text-sm text-text-muted dark:text-text-muted-dark">
        @{user.username}
      </p>

      {/* Bio */}
      {user.bio && (
        <p className="mt-3 max-w-xs text-sm text-text dark:text-text-dark">
          {user.bio}
        </p>
      )}
    </Card>
  );
}
