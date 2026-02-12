'use client';

import { ModerationQueue } from '@/components/admin/ModerationQueue';

export default function ModerationPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Content Moderation
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Review reported and flagged content.
        </p>
      </div>
      <ModerationQueue />
    </div>
  );
}
