'use client';

import { UserBrowser } from '@/components/admin/UserBrowser';

export default function AdminUsersPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          User Management
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Search, edit, and manage users.
        </p>
      </div>

      <UserBrowser />
    </div>
  );
}
