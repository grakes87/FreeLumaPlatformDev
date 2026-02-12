'use client';

import { Film } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export default function AnimationsPage() {
  return (
    <EmptyState
      icon={<Film className="h-12 w-12" />}
      title="Luma Animations"
      description="Animated Bible stories brought to life. Coming soon."
      className="min-h-[calc(100vh-7.5rem)]"
    />
  );
}
