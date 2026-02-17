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

/** Slug-based gradient map so each category gets a distinct, thematic circle color */
const CATEGORY_GRADIENTS: Record<string, string> = {
  'hope-encouragement': 'from-yellow-400 to-amber-500',
  'anxiety-stress': 'from-teal-400 to-cyan-600',
  'faith-trust': 'from-blue-500 to-indigo-600',
  'healing-strength': 'from-emerald-400 to-green-600',
  'love-relationships': 'from-pink-400 to-rose-500',
  'gratitude-thanksgiving': 'from-orange-400 to-amber-600',
  'forgiveness-mercy': 'from-violet-400 to-purple-600',
  'peace-comfort': 'from-sky-400 to-blue-500',
  'wisdom-guidance': 'from-amber-400 to-yellow-600',
  'courage-overcoming-fear': 'from-red-500 to-rose-700',
};

const DEFAULT_GRADIENT = 'from-amber-600/90 to-rose-500/90';

/** Renders the circle icon for a category — gradient bg + white icon PNG or Sparkles for "All" */
function CategoryIcon({
  category,
  size,
  isActive,
}: {
  category: VerseCategoryData;
  size: 'sm' | 'lg';
  isActive: boolean;
}) {
  const isAll = category.id === 'all';
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-14 w-14';
  const iconDim = size === 'sm' ? 'h-4 w-4' : 'h-7 w-7';
  const gradient = isAll
    ? 'from-blue-500 to-purple-500'
    : CATEGORY_GRADIENTS[category.slug] || DEFAULT_GRADIENT;

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full transition-all',
        dim,
        isActive
          ? 'scale-110 opacity-100 ring-2 ring-blue-400'
          : 'opacity-80 ring-1 ring-white/30'
      )}
    >
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-gradient-to-br',
          gradient,
        )}
      >
        {isAll ? (
          <Sparkles className={cn(iconDim, 'text-white')} />
        ) : category.thumbnail_url ? (
          <img
            src={category.thumbnail_url}
            alt=""
            className={cn(iconDim, 'object-contain')}
            draggable={false}
          />
        ) : (
          <span className={cn('font-bold text-white', size === 'sm' ? 'text-xs' : 'text-lg')}>
            {category.name.charAt(0)}
          </span>
        )}
      </div>
    </div>
  );
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

  // Collapsed view: pill button + labels below
  if (collapsed) {
    return (
      <div className="absolute top-20 left-0 right-0 z-30 flex flex-col items-center gap-2 px-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-xl transition-all active:scale-95"
        >
          {activeCategory && (
            <CategoryIcon category={activeCategory} size="sm" isActive={false} />
          )}
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
    <>
      {/* Invisible backdrop to close on outside click */}
      <div
        className="fixed inset-0 z-30"
        onClick={onToggle}
        aria-hidden="true"
      />
      <div className="absolute top-20 left-0 right-0 z-40 px-4 transition-all duration-200">
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

          {/* Category grid — 3 columns for readable names */}
          <div className="grid grid-cols-3 gap-4">
            {categories.map((category) => {
              const isActive = category.id === activeCategoryId;

              return (
                <button
                  key={String(category.id)}
                  type="button"
                  onClick={() => handleSelect(category.id)}
                  className="flex flex-col items-center gap-1.5 transition-all"
                >
                  <CategoryIcon category={category} size="lg" isActive={isActive} />
                  <span
                    className={cn(
                      'max-w-full text-center text-xs leading-tight',
                      isActive ? 'font-semibold text-white' : 'text-white/80'
                    )}
                  >
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
