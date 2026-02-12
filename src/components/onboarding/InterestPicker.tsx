'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Heart,
  Music,
  Users,
  Sun,
  Star,
  Flame,
  Leaf,
  Coffee,
  Globe,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface CategoryData {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
}

// Map icon names from DB to Lucide components
const ICON_MAP: Record<string, typeof BookOpen> = {
  'book-open': BookOpen,
  heart: Heart,
  music: Music,
  users: Users,
  sun: Sun,
  star: Star,
  flame: Flame,
  leaf: Leaf,
  coffee: Coffee,
  globe: Globe,
  sparkles: Sparkles,
  'message-circle': MessageCircle,
};

function getCategoryIcon(iconName: string | null) {
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName];
  }
  return Star; // default icon
}

export function InterestPicker() {
  const router = useRouter();
  const toast = useToast();

  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) throw new Error('Failed to fetch categories');
        const data = await res.json();
        setCategories(data.categories || []);
      } catch {
        toast.error('Failed to load categories');
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCategory = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one interest');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ categories: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save interests');
      }

      router.push('/onboarding/follow');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Pick Your Interests
        </h1>
        <p className="mt-2 text-text-muted dark:text-text-muted-dark">
          Select topics that resonate with you. We will personalize your
          experience.
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="text-center text-text-muted dark:text-text-muted-dark">
          No categories available yet. You can set your interests later in
          settings.
        </p>
      ) : (
        <div className="grid w-full grid-cols-2 gap-3">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);
            const isSelected = selectedIds.has(category.id);

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all',
                  'bg-surface dark:bg-surface-dark',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm dark:bg-primary/10'
                    : 'border-border hover:border-primary/40 dark:border-border-dark dark:hover:border-primary/40'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                    isSelected
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isSelected
                      ? 'text-primary'
                      : 'text-text dark:text-text-dark'
                  )}
                >
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="w-full">
        <p className="mb-3 text-center text-xs text-text-muted dark:text-text-muted-dark">
          {selectedIds.size === 0
            ? 'Select at least 1 interest to continue'
            : `${selectedIds.size} selected`}
        </p>
        <Button
          onClick={handleContinue}
          disabled={selectedIds.size === 0}
          loading={saving}
          fullWidth
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
