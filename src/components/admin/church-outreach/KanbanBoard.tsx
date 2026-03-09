'use client';

import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { KanbanColumn } from './KanbanColumn';
import { ChurchCard, type ChurchCardData } from './ChurchCard';

// Lazy-load ChurchDetailModal to keep bundle size down
const ChurchDetailModal = lazy(() => import('./ChurchDetailModal'));

const PIPELINE_STAGES = [
  'new_lead',
  'contacted',
  'engaged',
  'sample_requested',
  'sample_sent',
  'converted',
  'lost',
] as const;

type PipelineStage = (typeof PIPELINE_STAGES)[number];
type ChurchesByStage = Record<PipelineStage, ChurchCardData[]>;

function emptyStageMap(): ChurchesByStage {
  const map = {} as ChurchesByStage;
  for (const stage of PIPELINE_STAGES) {
    map[stage] = [];
  }
  return map;
}

function groupByStage(churches: ChurchCardData[]): ChurchesByStage {
  const grouped = emptyStageMap();
  for (const church of churches) {
    const stage = church.pipeline_stage as PipelineStage;
    if (grouped[stage]) {
      grouped[stage].push(church);
    } else {
      // Fallback to new_lead if unknown stage
      grouped.new_lead.push(church);
    }
  }
  return grouped;
}

function findChurchStage(
  churches: ChurchesByStage,
  churchId: number
): PipelineStage | null {
  for (const stage of PIPELINE_STAGES) {
    if (churches[stage].some((c) => c.id === churchId)) {
      return stage;
    }
  }
  return null;
}

function findChurchById(
  churches: ChurchesByStage,
  churchId: number
): ChurchCardData | null {
  for (const stage of PIPELINE_STAGES) {
    const found = churches[stage].find((c) => c.id === churchId);
    if (found) return found;
  }
  return null;
}

/** Determine which column (stage) a droppable id belongs to */
function resolveStage(
  overId: string,
  churches: ChurchesByStage
): PipelineStage | null {
  // If the overId is a stage key, return directly
  if (PIPELINE_STAGES.includes(overId as PipelineStage)) {
    return overId as PipelineStage;
  }
  // Otherwise, it's a card id like "church-123"
  const idMatch = overId.match(/^church-(\d+)$/);
  if (idMatch) {
    const churchId = parseInt(idMatch[1], 10);
    return findChurchStage(churches, churchId);
  }
  return null;
}

// Loading skeleton
function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto p-4">
      {PIPELINE_STAGES.map((stage) => (
        <div
          key={stage}
          className="min-w-[280px] max-w-[300px] flex-shrink-0 animate-pulse rounded-lg border-t-2 border-t-gray-200 bg-slate-50 p-3 dark:bg-slate-800/50"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="mb-2 h-20 rounded-lg bg-slate-200 dark:bg-slate-700"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function KanbanBoard() {
  const toast = useToast();
  const [churches, setChurches] = useState<ChurchesByStage>(emptyStageMap());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChurch, setActiveChurch] = useState<ChurchCardData | null>(null);
  const [selectedChurchId, setSelectedChurchId] = useState<number | null>(null);
  const [columnLimits, setColumnLimits] = useState<Record<string, number>>({});

  // DnD sensors -- distance: 8 prevents click from triggering drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const fetchChurches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/church-outreach/churches?limit=500', {
          credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch churches');
      const data = await res.json();
      const allChurches: ChurchCardData[] = ((data.data ?? data).churches || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => ({
          id: c.id,
          name: c.name,
          city: c.city,
          state: c.state,
          pastor_name: c.pastor_name,
          contact_email: c.contact_email,
          contact_phone: c.contact_phone,
          youth_programs: c.youth_programs,
          updated_at: c.updated_at,
          pipeline_stage: c.pipeline_stage,
          denomination: c.denomination,
        })
      );
      setChurches(groupByStage(allChurches));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChurches();
  }, [fetchChurches]);

  // --- Drag handlers ---

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const idStr = String(active.id);
      const idMatch = idStr.match(/^church-(\d+)$/);
      if (idMatch) {
        const church = findChurchById(churches, parseInt(idMatch[1], 10));
        setActiveChurch(church);
      }
    },
    [churches]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      const activeIdMatch = activeId.match(/^church-(\d+)$/);
      if (!activeIdMatch) return;

      const churchId = parseInt(activeIdMatch[1], 10);
      const fromStage = findChurchStage(churches, churchId);
      const toStage = resolveStage(overId, churches);

      if (!fromStage || !toStage || fromStage === toStage) return;

      // Optimistic move
      setChurches((prev) => {
        const church = prev[fromStage].find((c) => c.id === churchId);
        if (!church) return prev;

        return {
          ...prev,
          [fromStage]: prev[fromStage].filter((c) => c.id !== churchId),
          [toStage]: [{ ...church, pipeline_stage: toStage }, ...prev[toStage]],
        };
      });
    },
    [churches]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveChurch(null);

      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      const activeIdMatch = activeId.match(/^church-(\d+)$/);
      if (!activeIdMatch) return;

      const churchId = parseInt(activeIdMatch[1], 10);
      const toStage = resolveStage(overId, churches);

      if (!toStage) return;

      // Find church in current state to verify stage
      const church = findChurchById(churches, churchId);
      if (!church) return;

      // The church was already moved in state by onDragOver, so
      // church.pipeline_stage should equal toStage if it was moved.
      // We need the *original* stage from before the drag sequence,
      // but since we already did optimistic update, we check the active data.
      const originalStage = (active.data?.current as { church?: ChurchCardData })?.church
        ?.pipeline_stage as PipelineStage | undefined;

      if (!originalStage || originalStage === toStage) return;

      // Persist to API
      try {
        const res = await fetch('/api/admin/church-outreach/pipeline', {
          credentials: 'include',
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ churchId, stage: toStage }),
        });

        if (!res.ok) {
          throw new Error('Failed to update pipeline stage');
        }

        toast.success(
          `Moved "${church.name}" to ${toStage.replace(/_/g, ' ')}`
        );
      } catch {
        // Revert on error
        setChurches((prev) => {
          const movedChurch = prev[toStage].find((c) => c.id === churchId);
          if (!movedChurch) return prev;

          return {
            ...prev,
            [toStage]: prev[toStage].filter((c) => c.id !== churchId),
            [originalStage]: [
              { ...movedChurch, pipeline_stage: originalStage },
              ...prev[originalStage],
            ],
          };
        });
        toast.error('Failed to move church. Reverted.');
      }
    },
    [churches, toast]
  );

  // --- Card click handler ---

  const handleCardClick = useCallback((church: ChurchCardData) => {
    setSelectedChurchId(church.id);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedChurchId(null);
  }, []);

  const handleModalUpdate = useCallback(() => {
    setSelectedChurchId(null);
    fetchChurches();
  }, [fetchChurches]);

  // Show more handler per column
  const getColumnLimit = useCallback(
    (stage: string) => columnLimits[stage] || 20,
    [columnLimits]
  );

  const handleShowMore = useCallback((stage: string) => {
    setColumnLimits((prev) => ({
      ...prev,
      [stage]: (prev[stage] || 20) + 20,
    }));
  }, []);

  // Total count
  const totalCount = useMemo(
    () => PIPELINE_STAGES.reduce((sum, stage) => sum + churches[stage].length, 0),
    [churches]
  );

  if (loading) return <KanbanSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-red-500">{error}</p>
        <Button variant="outline" onClick={fetchChurches}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          {totalCount} {totalCount === 1 ? 'church' : 'churches'} across{' '}
          {PIPELINE_STAGES.length} stages
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchChurches}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className={cn(
            'flex gap-4 overflow-x-auto px-4 pb-4',
            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600'
          )}
        >
          {PIPELINE_STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              churches={churches[stage]}
              onCardClick={handleCardClick}
              visibleLimit={getColumnLimit(stage)}
              onShowMore={() => handleShowMore(stage)}
            />
          ))}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeChurch ? (
            <ChurchCard church={activeChurch} isOverlay isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Church Detail Modal */}
      {selectedChurchId && (
        <Suspense fallback={null}>
          <ChurchDetailModal
            churchId={selectedChurchId}
            isOpen={!!selectedChurchId}
            onClose={handleModalClose}
            onUpdate={handleModalUpdate}
          />
        </Suspense>
      )}
    </div>
  );
}
