'use client';

import React, { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Mail, Phone, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ChurchCardData {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  pastor_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  youth_programs: string[] | null;
  updated_at: string;
  pipeline_stage: string;
  denomination: string | null;
}

interface ChurchCardProps {
  church: ChurchCardData;
  onClick?: (church: ChurchCardData) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function ChurchCardInner({ church, onClick, isDragging, isOverlay }: ChurchCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: `church-${church.id}`,
    data: { church },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragging = isDragging || isSortableDragging;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(church);
      }}
      className={cn(
        'rounded-lg border border-border bg-white p-3 shadow-sm transition-shadow',
        'dark:border-border-dark dark:bg-surface-dark',
        'cursor-grab active:cursor-grabbing',
        'hover:shadow-md',
        dragging && 'opacity-40',
        isOverlay && 'shadow-lg ring-2 ring-primary/30 cursor-grabbing'
      )}
    >
      {/* Church name */}
      <p className="truncate text-sm font-semibold text-text dark:text-text-dark">
        {church.name}
      </p>

      {/* City, State */}
      {(church.city || church.state) && (
        <p className="mt-0.5 truncate text-xs text-text-muted dark:text-text-muted-dark">
          {[church.city, church.state].filter(Boolean).join(', ')}
        </p>
      )}

      {/* Pastor name */}
      {church.pastor_name && (
        <p className="mt-0.5 truncate text-xs text-text-muted dark:text-text-muted-dark">
          Pastor: {church.pastor_name}
        </p>
      )}

      {/* Contact indicators + youth program tags */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {church.contact_email && (
          <Mail className="h-3 w-3 text-blue-500" aria-label="Has email" />
        )}
        {church.contact_phone && (
          <Phone className="h-3 w-3 text-green-500" aria-label="Has phone" />
        )}
        {(Array.isArray(church.youth_programs) ? church.youth_programs : []).slice(0, 3).map((program) => (
          <span
            key={program}
            className="inline-block rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
          >
            {program}
          </span>
        ))}
        {Array.isArray(church.youth_programs) && church.youth_programs.length > 3 && (
          <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
            +{church.youth_programs.length - 3}
          </span>
        )}
      </div>

      {/* Last activity */}
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-text-muted dark:text-text-muted-dark">
        <Clock className="h-2.5 w-2.5" />
        {formatRelativeTime(church.updated_at)}
      </div>
    </div>
  );
}

export const ChurchCard = memo(ChurchCardInner);
