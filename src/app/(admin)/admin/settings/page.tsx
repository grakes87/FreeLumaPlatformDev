'use client';

import { AdminSettings } from '@/components/admin/AdminSettings';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Platform Settings
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Configure feed display, moderation, registration, and mode isolation.
        </p>
      </div>
      <AdminSettings />
    </div>
  );
}
