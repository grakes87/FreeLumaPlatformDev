'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { DailyPostCarousel } from '@/components/daily/DailyPostCarousel';

interface DailyDatePageProps {
  params: Promise<{ date: string }>;
}

/**
 * Validate date format YYYY-MM-DD.
 */
function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export default function DailyDatePage({ params }: DailyDatePageProps) {
  const { date } = use(params);

  if (!isValidDate(date)) {
    notFound();
  }

  return <DailyPostCarousel date={date} />;
}
