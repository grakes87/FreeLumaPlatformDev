'use client';

import { useMemo } from 'react';

interface ReviewMonthTabProps {
  month: string;
  mode: 'bible' | 'positivity';
  language: string;
}

/**
 * Phone-frame preview tab that loads the daily feed in an iframe.
 * The iframe gets its own 375x812 viewport so all mobile styles,
 * responsive breakpoints, and viewport units work correctly.
 */
export function ReviewMonthTab({ month, mode, language }: ReviewMonthTabProps) {
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({ month, mode, language });
    return `/preview-feed?${params}`;
  }, [month, mode, language]);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="text-sm text-text-muted dark:text-text-muted-dark">
        Scroll to preview daily content as users would see it
      </p>

      {/* Phone frame */}
      <div
        className="relative mx-auto overflow-hidden rounded-[2.5rem] border-4 border-gray-800 shadow-2xl bg-[#0a0a0f]"
        style={{ width: 375, height: 812 }}
      >
        <iframe
          src={iframeSrc}
          className="h-full w-full border-0"
          title="Monthly content preview"
        />
      </div>
    </div>
  );
}
