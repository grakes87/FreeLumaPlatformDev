'use client';

import { BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export default function BibleStudiesPage() {
  return (
    <EmptyState
      icon={<BookOpen className="h-12 w-12" />}
      title="Bible Studies"
      description="Live and recorded Bible study workshops with your community. Coming soon."
      className="min-h-[calc(100vh-7.5rem)]"
    />
  );
}
