'use client';

import { useState, useEffect } from 'react';
import type { ContentItem, EngagementTargetType } from '@/lib/ai-engagement/types';

interface TargetSelectorProps {
  type: EngagementTargetType;
  onTypeChange: (type: EngagementTargetType) => void;
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  items: ContentItem[];
  onItemsLoaded: (items: ContentItem[]) => void;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

export default function TargetSelector({
  type,
  onTypeChange,
  selectedIds,
  onSelectionChange,
  items,
  onItemsLoaded,
}: TargetSelectorProps) {
  // Daily filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  });
  const [mode, setMode] = useState<'bible' | 'positivity'>('bible');
  const [language, setLanguage] = useState('en');

  // Verse category filters
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);

  // Fetch categories on mount (for verse-category type)
  useEffect(() => {
    fetch('/api/admin/verse-categories', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
  }, []);

  const fetchContent = async () => {
    setLoading(true);
    onSelectionChange(new Set());

    try {
      let url: string;
      if (type === 'daily') {
        url = `/api/admin/ai-engagement/content?type=daily&start=${startDate}&end=${endDate}&mode=${mode}&language=${language}`;
      } else {
        if (!categoryId) {
          onItemsLoaded([]);
          setLoading(false);
          return;
        }
        url = `/api/admin/ai-engagement/content?type=verse-category&category_id=${categoryId}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      onItemsLoaded(data.items || []);
    } catch {
      onItemsLoaded([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(items.map((i) => i.id)));
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Type toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { onTypeChange('daily'); onItemsLoaded([]); onSelectionChange(new Set()); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            type === 'daily'
              ? 'bg-primary text-white'
              : 'bg-surface-hover text-text-muted dark:bg-surface-hover-dark dark:text-text-muted-dark'
          }`}
        >
          Daily Content
        </button>
        <button
          onClick={() => { onTypeChange('verse-category'); onItemsLoaded([]); onSelectionChange(new Set()); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            type === 'verse-category'
              ? 'bg-primary text-white'
              : 'bg-surface-hover text-text-muted dark:bg-surface-hover-dark dark:text-text-muted-dark'
          }`}
        >
          Verse by Category
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        {type === 'daily' ? (
          <>
            <label className="space-y-1">
              <span className="text-xs font-medium text-text-muted dark:text-text-muted-dark">Start</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="block rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-border-dark dark:bg-background-dark dark:text-text-dark" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-text-muted dark:text-text-muted-dark">End</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="block rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-border-dark dark:bg-background-dark dark:text-text-dark" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-text-muted dark:text-text-muted-dark">Mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as 'bible' | 'positivity')}
                className="block rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-border-dark dark:bg-background-dark dark:text-text-dark">
                <option value="bible">Bible</option>
                <option value="positivity">Positivity</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-text-muted dark:text-text-muted-dark">Language</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}
                className="block rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-border-dark dark:bg-background-dark dark:text-text-dark">
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </label>
          </>
        ) : (
          <label className="space-y-1">
            <span className="text-xs font-medium text-text-muted dark:text-text-muted-dark">Category</span>
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              className="block min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-border-dark dark:bg-background-dark dark:text-text-dark"
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}

        <button
          onClick={fetchContent}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load Content'}
        </button>
      </div>

      {/* Content list */}
      {items.length > 0 && (
        <div className="rounded-xl border border-border dark:border-border-dark">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border bg-surface-hover/50 px-4 py-3 dark:border-border-dark dark:bg-surface-hover-dark/50">
            <input
              type="checkbox"
              checked={selectedIds.size === items.length && items.length > 0}
              onChange={toggleAll}
              className="h-4 w-4 rounded accent-primary"
            />
            <span className="text-sm font-medium text-text dark:text-text-dark">
              {selectedIds.size} of {items.length} selected
            </span>
          </div>

          {/* Items */}
          <div className="max-h-[400px] divide-y divide-border overflow-y-auto dark:divide-border-dark">
            {items.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/50 dark:hover:bg-surface-hover-dark/50"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleOne(item.id)}
                  className="h-4 w-4 shrink-0 rounded accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-text dark:text-text-dark">
                      {item.label}
                    </span>
                    {item.verse_reference && type === 'daily' && (
                      <span className="text-xs text-text-muted dark:text-text-muted-dark">
                        ({item.verse_reference})
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-text-muted dark:text-text-muted-dark">
                    {item.content_text}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3 text-xs text-text-muted dark:text-text-muted-dark">
                  <span>{item.existing_comment_count} comments</span>
                  <span>{item.existing_reaction_count} reactions</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
