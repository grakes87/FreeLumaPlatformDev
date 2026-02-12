'use client';

import { Heart } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export default function PrayerWallPage() {
  return (
    <EmptyState
      icon={<Heart className="h-12 w-12" />}
      title="Prayer Wall"
      description="Share and support prayer requests with your community. Coming in Phase 2."
      className="min-h-[calc(100vh-7.5rem)]"
    />
  );
}
