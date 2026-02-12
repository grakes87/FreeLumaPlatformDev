'use client';

import { MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export default function FeedPage() {
  return (
    <EmptyState
      icon={<MessageSquare className="h-12 w-12" />}
      title="Feed"
      description="Connect with your community through posts, likes, and comments. Coming in Phase 2."
      className="min-h-[calc(100vh-7.5rem)]"
    />
  );
}
