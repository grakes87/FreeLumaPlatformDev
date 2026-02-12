'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { EditProfileForm } from '@/components/profile/EditProfileForm';

interface FullProfileData {
  user: {
    id: number;
    display_name: string;
    username: string;
    bio: string | null;
    avatar_url: string | null;
    avatar_color: string;
    profile_privacy: 'public' | 'private';
    date_of_birth: string | null;
    location: string | null;
    website: string | null;
    mode: string;
    denomination: string | null;
    church: string | null;
  };
}

/**
 * Edit profile page: fetches current profile data and renders EditProfileForm.
 * On save success: navigates back to profile.
 */
export default function EditProfilePage() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<FullProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const res = await fetch(
          `/api/users/${encodeURIComponent(user.username)}/profile`,
          { credentials: 'include' }
        );

        if (res.ok) {
          const data = await res.json();
          setProfileData(data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  if (loading || !profileData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted dark:text-text-muted-dark" />
      </div>
    );
  }

  return (
    <EditProfileForm
      initialData={{
        id: profileData.user.id,
        display_name: profileData.user.display_name,
        username: profileData.user.username,
        bio: profileData.user.bio,
        avatar_url: profileData.user.avatar_url,
        avatar_color: profileData.user.avatar_color,
        profile_privacy: profileData.user.profile_privacy,
        date_of_birth: profileData.user.date_of_birth,
        location: profileData.user.location,
        website: profileData.user.website,
        mode: profileData.user.mode,
        denomination: profileData.user.denomination,
        church: profileData.user.church,
      }}
    />
  );
}
