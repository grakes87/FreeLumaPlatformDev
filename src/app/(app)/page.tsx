'use client';

import { Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export default function DailyPostPage() {
  return (
    <EmptyState
      icon={<Sparkles className="h-12 w-12" />}
      title="Daily Post"
      description="Your daily inspiration experience is coming soon. Full-screen video backgrounds, Bible verses, and audio content."
      className="min-h-[calc(100vh-7.5rem)]"
    />
  );
}
