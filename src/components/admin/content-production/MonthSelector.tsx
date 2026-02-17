'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface MonthSelectorProps {
  /** Current month in YYYY-MM format */
  month: string;
  onChange: (month: string) => void;
}

export function MonthSelector({ month, onChange }: MonthSelectorProps) {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10); // 1-based

  const label = `${MONTH_NAMES[monthNum - 1]} ${year}`;

  const navigate = (delta: number) => {
    let newMonth = monthNum + delta;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    onChange(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-[10rem] text-center text-lg font-semibold text-text dark:text-text-dark">
        {label}
      </span>
      <button
        type="button"
        onClick={() => navigate(1)}
        className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
        aria-label="Next month"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
