'use client';

import { useCallback } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { VerseCategoryData } from '@/hooks/useVerseByCategoryFeed';

interface CategorySelectorProps {
  categories: VerseCategoryData[];
  activeCategoryId: number | 'all';
  onSelect: (id: number | 'all') => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function CategorySelector({
  categories,
  activeCategoryId,
  onSelect,
  collapsed,
  onToggle,
}: CategorySelectorProps) {
  const activeCategory = categories.find(
    (c) => c.id === activeCategoryId
  );

  const handleSelect = useCallback(
    (id: number | 'all') => {
      onSelect(id);
    },
    [onSelect]
  );

  // Collapsed view: horizontal row with active category
  if (collapsed) {
    return (
      <div className="absolute top-16 left-0 right-0 z-20 px-4">
        <button
          type="button"
          onClick={onToggle}
          className="mx-auto flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-xl transition-all active:scale-95"
        >
          {/* Active category circle */}
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/50">
            {activeCategory?.thumbnail_url ? (
              <img
                src={activeCategory.thumbnail_url}
                alt={activeCategory.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500">
                {activeCategoryId === 'all' ? (
                  <Sparkles className="h-4 w-4 text-white" />
                ) : (
                  <span className="text-xs font-bold text-white">
                    {activeCategory?.name?.charAt(0) ?? '?'}
                  </span>
                )}
              </div>
            )}
          </div>

          <span className="text-xs font-medium text-white/90">
            {activeCategory?.name ?? 'All'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-white/60" />
        </button>
      </div>
    );
  }

  // Expanded view: backdrop-blur grid
  return (
    <div className="absolute top-16 left-0 right-0 z-20 px-4 transition-all duration-200">
      <div className="rounded-2xl bg-black/40 p-4 backdrop-blur-xl">
        {/* Header with collapse button */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
            Categories
          </span>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-5 gap-3">
          {categories.map((category) => {
            const isActive = category.id === activeCategoryId;
            const isAll = category.id === 'all';

            return (
              <button
                key={String(category.id)}
                type="button"
                onClick={() => handleSelect(category.id)}
                className="flex flex-col items-center gap-1 transition-all"
              >
                {/* Circle */}
                <div
                  className={cn(
                    'flex h-14 w-14 items-center justify-center overflow-hidden rounded-full transition-all',
                    isActive
                      ? 'scale-110 opacity-100 ring-2 ring-blue-400'
                      : 'opacity-70 ring-1 ring-white/30'
                  )}
                >
                  {category.thumbnail_url ? (
                    <img
                      src={category.thumbnail_url}
                      alt={category.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className={cn(
                      'flex h-full w-full items-center justify-center',
                      isAll
                        ? 'bg-gradient-to-br from-blue-500 to-purple-500'
                        : 'bg-gradient-to-br from-amber-500 to-rose-500'
                    )}>
                      {isAll ? (
                        <Sparkles className="h-5 w-5 text-white" />
                      ) : (
                        <span className="text-lg font-bold text-white">
                          {category.name.charAt(0)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Name */}
                <span className="line-clamp-1 max-w-full text-[10px] text-white/80">
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
