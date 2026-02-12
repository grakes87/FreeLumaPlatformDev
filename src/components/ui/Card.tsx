'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

const paddingStyles = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof paddingStyles;
  hoverable?: boolean;
}

export function Card({
  padding = 'md',
  hoverable = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface shadow-sm',
        'dark:border-border-dark dark:bg-surface-dark',
        paddingStyles[padding],
        hoverable && 'transition-shadow hover:shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
