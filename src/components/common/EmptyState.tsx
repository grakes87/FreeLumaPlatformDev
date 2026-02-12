import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-12 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-text-muted dark:text-text-muted-dark">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-text dark:text-text-dark">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-text-muted dark:text-text-muted-dark">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
