'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';

interface VideoCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  video_count?: number;
}

interface VideoCategoryManagerProps {
  onCategoriesChange?: () => void;
}

export function VideoCategoryManager({
  onCategoriesChange,
}: VideoCategoryManagerProps) {
  const toast = useToast();
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/video-categories', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setAdding(true);
    try {
      const maxOrder = categories.reduce(
        (max, c) => Math.max(max, c.sort_order),
        -1
      );
      const res = await fetch('/api/video-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          sort_order: maxOrder + 1,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create category');
      }

      toast.success('Category created');
      setNewName('');
      setNewDescription('');
      setShowAddForm(false);
      fetchCategories();
      onCategoriesChange?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create category'
      );
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (cat: VideoCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/video-categories/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update category');
      }

      toast.success('Category updated');
      cancelEdit();
      fetchCategories();
      onCategoriesChange?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update category'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/video-categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete category');
      }

      toast.success('Category deleted');
      fetchCategories();
      onCategoriesChange?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete category'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleReorder = async (id: number, direction: 'up' | 'down') => {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const current = categories[idx];
    const swap = categories[swapIdx];

    // Swap sort_order values
    try {
      await Promise.all([
        fetch(`/api/video-categories/${current.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sort_order: swap.sort_order }),
        }),
        fetch(`/api/video-categories/${swap.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sort_order: current.sort_order }),
        }),
      ]);
      fetchCategories();
    } catch {
      toast.error('Failed to reorder');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text dark:text-text-dark">
          Video Categories
        </h3>
        <Button
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? 'secondary' : 'primary'}
        >
          {showAddForm ? (
            <>
              <X className="h-4 w-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Add Category
            </>
          )}
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 dark:bg-primary/10"
        >
          <Input
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            required
            disabled={adding}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Description (optional)
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief description"
              disabled={adding}
              rows={2}
              className={cn(
                'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text transition-colors placeholder:text-text-muted',
                'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
                'resize-none disabled:cursor-not-allowed disabled:opacity-60'
              )}
            />
          </div>
          <Button type="submit" size="sm" loading={adding}>
            Create Category
          </Button>
        </form>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          <FolderOpen className="h-10 w-10" />
          <p className="text-sm">No categories yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => handleReorder(cat.id, 'up')}
                  disabled={idx === 0}
                  className="rounded p-0.5 text-text-muted hover:text-text disabled:opacity-30 dark:text-text-muted-dark dark:hover:text-text-dark"
                  title="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReorder(cat.id, 'down')}
                  disabled={idx === categories.length - 1}
                  className="rounded p-0.5 text-text-muted hover:text-text disabled:opacity-30 dark:text-text-muted-dark dark:hover:text-text-dark"
                  title="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                {editingId === cat.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Category name"
                      disabled={saving}
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description"
                      disabled={saving}
                      rows={2}
                      className={cn(
                        'w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text placeholder:text-text-muted',
                        'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                        'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
                        'resize-none'
                      )}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={saving || !editName.trim()}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        className="flex items-center gap-1 rounded-lg bg-gray-200 px-3 py-1 text-xs font-medium text-text hover:bg-gray-300 dark:bg-gray-700 dark:text-text-dark dark:hover:bg-gray-600"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-text dark:text-text-dark">
                      {cat.name}
                    </p>
                    {cat.description && (
                      <p className="mt-0.5 text-sm text-text-muted dark:text-text-muted-dark">
                        {cat.description}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Video count badge */}
              <span className="shrink-0 rounded-full bg-surface-hover px-2.5 py-1 text-xs font-medium text-text-muted dark:bg-surface-hover-dark dark:text-text-muted-dark">
                {cat.video_count ?? 0} video{(cat.video_count ?? 0) !== 1 ? 's' : ''}
              </span>

              {/* Action buttons */}
              {editingId !== cat.id && (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat.id)}
                    disabled={
                      deletingId === cat.id || (cat.video_count ?? 0) > 0
                    }
                    className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-text-muted-dark dark:hover:bg-red-500/10"
                    title={
                      (cat.video_count ?? 0) > 0
                        ? 'Cannot delete: has assigned videos'
                        : 'Delete'
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
