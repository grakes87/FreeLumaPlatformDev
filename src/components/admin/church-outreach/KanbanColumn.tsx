'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils/cn';
import { ChurchCard, type ChurchCardData } from './ChurchCard';

const STAGE_COLORS: Record<string, string> = {
  new_lead: 'border-t-blue-500',
  contacted: 'border-t-indigo-500',
  engaged: 'border-t-purple-500',
  sample_requested: 'border-t-amber-500',
  sample_sent: 'border-t-orange-500',
  converted: 'border-t-green-500',
  lost: 'border-t-gray-400',
};

const STAGE_BG_COLORS: Record<string, string> = {
  new_lead: 'bg-blue-500',
  contacted: 'bg-indigo-500',
  engaged: 'bg-purple-500',
  sample_requested: 'bg-amber-500',
  sample_sent: 'bg-orange-500',
  converted: 'bg-green-500',
  lost: 'bg-gray-400',
};

function formatStageLabel(stage: string): string {
  return stage
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface KanbanColumnProps {
  stage: string;
  churches: ChurchCardData[];
  onCardClick: (church: ChurchCardData) => void;
  visibleLimit?: number;
  onShowMore?: () => void;
}

export function KanbanColumn({
  stage,
  churches,
  onCardClick,
  visibleLimit = 20,
  onShowMore,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: { stage },
  });

  const visibleChurches = churches.slice(0, visibleLimit);
  const hasMore = churches.length > visibleLimit;

  return (
    <div
      className={cn(
        'flex min-w-[280px] max-w-[300px] flex-shrink-0 flex-col rounded-lg border-t-2 bg-slate-50',
        'dark:bg-slate-800/50',
        STAGE_COLORS[stage] || 'border-t-gray-300',
        isOver && 'ring-2 ring-primary/30'
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-sm font-semibold text-text dark:text-text-dark">
          {formatStageLabel(stage)}
        </h3>
        <span
          className={cn(
            'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white',
            STAGE_BG_COLORS[stage] || 'bg-gray-400'
          )}
        >
          {churches.length}
        </span>
      </div>

      {/* Card list */}
      <div
        ref={setNodeRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
        style={{ maxHeight: 'calc(100vh - 220px)' }}
      >
        <SortableContext
          items={visibleChurches.map((c) => `church-${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {visibleChurches.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-muted dark:text-text-muted-dark">
              No churches
            </p>
          ) : (
            visibleChurches.map((church) => (
              <ChurchCard
                key={church.id}
                church={church}
                onClick={onCardClick}
              />
            ))
          )}
        </SortableContext>

        {hasMore && (
          <button
            onClick={onShowMore}
            className="mt-1 rounded-md py-1.5 text-center text-xs font-medium text-primary hover:bg-primary/5 dark:text-primary-light dark:hover:bg-primary/10"
          >
            Show {churches.length - visibleLimit} more...
          </button>
        )}
      </div>
    </div>
  );
}
