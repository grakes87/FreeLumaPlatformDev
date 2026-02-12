'use client';

import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Analytics
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Platform growth, engagement, and content insights.
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
