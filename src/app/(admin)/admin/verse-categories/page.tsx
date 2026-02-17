'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Loader2,
  Upload,
  Sparkles,
  Image as ImageIcon,
  BookOpen,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerseCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  active: boolean;
  verse_count?: number;
  media_count?: number;
  created_at: string;
}

interface VerseTranslation {
  id: number;
  translation_code: string;
  translated_text: string;
  source: string;
}

interface Verse {
  id: number;
  category_id: number;
  verse_reference: string;
  content_text: string;
  book: string;
  reaction_count?: number;
  comment_count?: number;
  translations?: VerseTranslation[];
  created_at: string;
}

interface MediaRecord {
  id: number;
  category_id: number | null;
  media_url: string;
  media_key: string;
  category?: { id: number; name: string } | null;
  created_at: string;
}

type TabKey = 'categories' | 'verses' | 'media';

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminVerseCategoriesPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('categories');

  // Shared state: selected category for Verses/Media tabs
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<VerseCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // ----- Categories fetch -----
  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch('/api/admin/verse-categories', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      } else {
        toast.error('Failed to load categories');
      }
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoadingCategories(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'categories', label: 'Categories' },
    { key: 'verses', label: 'Verses' },
    { key: 'media', label: 'Media' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Verse Categories
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Manage categories, verses, and background media for the verse-by-category system
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === t.key
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'categories' && (
        <CategoriesTab
          categories={categories}
          loading={loadingCategories}
          onRefresh={fetchCategories}
          onSelectCategory={(id) => {
            setSelectedCategoryId(id);
            setActiveTab('verses');
          }}
        />
      )}
      {activeTab === 'verses' && (
        <VersesTab
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
        />
      )}
      {activeTab === 'media' && (
        <MediaTab
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Categories
// ---------------------------------------------------------------------------

function CategoriesTab({
  categories,
  loading,
  onRefresh,
  onSelectCategory,
}: {
  categories: VerseCategory[];
  loading: boolean;
  onRefresh: () => void;
  onSelectCategory: (id: number) => void;
}) {
  const toast = useToast();

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Reorder state
  const [reordering, setReordering] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/verse-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() || undefined }),
      });
      if (res.ok) {
        toast.success('Category created');
        setShowCreate(false);
        setCreateName('');
        setCreateDesc('');
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create category');
      }
    } catch {
      toast.error('Failed to create category');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (cat: VerseCategory) => {
    try {
      const res = await fetch('/api/admin/verse-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: cat.id, active: !cat.active }),
      });
      if (res.ok) {
        toast.success(`${cat.name} ${cat.active ? 'deactivated' : 'activated'}`);
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleSaveEdit = async () => {
    if (!editId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/verse-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: editId,
          name: editName.trim(),
          description: editDesc.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success('Category updated');
        setEditId(null);
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleReorder = async (catId: number, direction: 'up' | 'down') => {
    const idx = categories.findIndex((c) => c.id === catId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const cat = categories[idx];
    const other = categories[swapIdx];

    setReordering(catId);
    try {
      // Swap sort_order values
      await Promise.all([
        fetch('/api/admin/verse-categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: cat.id, sort_order: other.sort_order }),
        }),
        fetch('/api/admin/verse-categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: other.id, sort_order: cat.sort_order }),
        }),
      ]);
      onRefresh();
    } catch {
      toast.error('Failed to reorder');
    } finally {
      setReordering(null);
    }
  };

  const startEdit = (cat: VerseCategory) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || '');
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <Skeleton height={16} className="w-1/4" />
            <Skeleton height={16} className="w-1/6" />
            <Skeleton height={16} className="w-16" />
            <Skeleton height={16} className="w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      {/* Create inline form */}
      {showCreate && (
        <div className="rounded-2xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
          <h3 className="mb-4 text-lg font-semibold text-text dark:text-text-dark">
            New Category
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <Input
                label="Name"
                placeholder="e.g., Faith & Trust"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                disabled={creating}
                autoFocus
              />
            </div>
            <div className="flex-1">
              <Input
                label="Description (optional)"
                placeholder="Brief description..."
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                disabled={creating}
              />
            </div>
            <Button onClick={handleCreate} loading={creating} disabled={!createName.trim()}>
              Create
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setShowCreate(false); setCreateName(''); setCreateDesc(''); }}
              disabled={creating}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Categories table */}
      {categories.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
          <BookOpen className="h-12 w-12 text-text-muted dark:text-text-muted-dark" />
          <p className="text-text-muted dark:text-text-muted-dark">
            No categories yet. Create your first category to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border dark:border-border-dark">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/50 dark:border-border-dark dark:bg-surface-hover-dark/50">
                <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">Name</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">Slug</th>
                <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Verses</th>
                <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Media</th>
                <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Active</th>
                <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Order</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-text-muted-dark">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {categories.map((cat, idx) => (
                <tr
                  key={cat.id}
                  className="bg-surface transition-colors hover:bg-surface-hover/30 dark:bg-surface-dark dark:hover:bg-surface-hover-dark/30"
                >
                  {editId === cat.id ? (
                    <>
                      <td className="px-4 py-3" colSpan={2}>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={cn(
                              'w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text',
                              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50',
                              'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                            )}
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Description..."
                            className={cn(
                              'w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text',
                              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50',
                              'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                            )}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted dark:text-text-muted-dark">
                        {cat.verse_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted dark:text-text-muted-dark">
                        {cat.media_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">--</td>
                      <td className="px-4 py-3 text-center text-text-muted dark:text-text-muted-dark">
                        {cat.sort_order}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={saving || !editName.trim()}
                            className="rounded-lg p-1.5 text-green-600 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                            title="Save"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditId(null)}
                            disabled={saving}
                            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onSelectCategory(cat.id)}
                          className="text-left font-medium text-primary hover:underline"
                        >
                          {cat.name}
                        </button>
                        {cat.description && (
                          <p className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark line-clamp-1">
                            {cat.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-text-muted dark:text-text-muted-dark">{cat.slug}</code>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-text dark:text-text-dark">
                        {cat.verse_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-text dark:text-text-dark">
                        {cat.media_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(cat)}
                          className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                            cat.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                          )}
                          role="switch"
                          aria-checked={cat.active}
                        >
                          <span
                            className={cn(
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
                              cat.active ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleReorder(cat.id, 'up')}
                            disabled={idx === 0 || reordering !== null}
                            className="rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30 dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                            title="Move up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <span className="w-6 text-center text-xs text-text-muted dark:text-text-muted-dark">
                            {cat.sort_order}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleReorder(cat.id, 'down')}
                            disabled={idx === categories.length - 1 || reordering !== null}
                            className="rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30 dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                            title="Move down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(cat)}
                            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Verses
// ---------------------------------------------------------------------------

function VersesTab({
  categories,
  selectedCategoryId,
  onCategoryChange,
}: {
  categories: VerseCategory[];
  selectedCategoryId: number | null;
  onCategoryChange: (id: number | null) => void;
}) {
  const toast = useToast();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 50;

  // Manual add state
  const [addRef, setAddRef] = useState('');
  const [addingVerse, setAddingVerse] = useState(false);

  // AI generation state
  const [showAI, setShowAI] = useState(false);
  const [aiCount, setAiCount] = useState(20);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiSelected, setAiSelected] = useState<Set<string>>(new Set());
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaveProgress, setAiSaveProgress] = useState({ current: 0, total: 0 });

  // Edit state
  const [editVerse, setEditVerse] = useState<Verse | null>(null);
  const [editRef, setEditRef] = useState('');
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm state
  const [deleteVerse, setDeleteVerse] = useState<Verse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const catId = selectedCategoryId;

  const fetchVerses = useCallback(async (categoryId: number, off: number, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      const res = await fetch(`/api/admin/verse-categories/${categoryId}/verses?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setVerses((prev) => [...prev, ...(data.verses || [])]);
        } else {
          setVerses(data.verses || []);
        }
        setTotal(data.total || 0);
        setOffset(off);
      } else {
        toast.error('Failed to load verses');
      }
    } catch {
      toast.error('Failed to load verses');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [toast]);

  useEffect(() => {
    if (catId) {
      setVerses([]);
      setOffset(0);
      fetchVerses(catId, 0);
    }
  }, [catId, fetchVerses]);

  const handleAddVerse = async () => {
    if (!catId || !addRef.trim()) return;
    setAddingVerse(true);
    try {
      const res = await fetch(`/api/admin/verse-categories/${catId}/verses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ verse_reference: addRef.trim(), auto_fetch: true }),
      });
      if (res.ok) {
        toast.success(`Added ${addRef.trim()} with translations`);
        setAddRef('');
        fetchVerses(catId, 0);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add verse');
      }
    } catch {
      toast.error('Failed to add verse');
    } finally {
      setAddingVerse(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!catId) return;
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    setAiLoading(true);
    setAiSuggestions([]);
    setAiSelected(new Set());
    try {
      const res = await fetch('/api/admin/verse-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category_id: catId,
          category_name: cat.name,
          count: aiCount,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const suggestions: string[] = data.suggestions || [];
        setAiSuggestions(suggestions);
        setAiSelected(new Set(suggestions));
        toast.success(`Generated ${suggestions.length} suggestions`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'AI generation failed');
      }
    } catch {
      toast.error('AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAISelected = async () => {
    if (!catId || aiSelected.size === 0) return;
    const selected = Array.from(aiSelected);
    setAiSaving(true);
    setAiSaveProgress({ current: 0, total: selected.length });

    let successCount = 0;
    let errorCount = 0;
    for (let i = 0; i < selected.length; i++) {
      setAiSaveProgress({ current: i + 1, total: selected.length });
      try {
        const res = await fetch(`/api/admin/verse-categories/${catId}/verses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ verse_reference: selected[i], auto_fetch: true }),
        });
        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setAiSaving(false);
    if (successCount > 0) {
      toast.success(`Saved ${successCount} verses${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
    } else {
      toast.error('Failed to save any verses');
    }
    setShowAI(false);
    setAiSuggestions([]);
    setAiSelected(new Set());
    fetchVerses(catId, 0);
  };

  const handleSaveEdit = async () => {
    if (!catId || !editVerse) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/verse-categories/${catId}/verses`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          verse_id: editVerse.id,
          verse_reference: editRef.trim() || undefined,
          content_text: editText.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Verse updated');
        setEditVerse(null);
        fetchVerses(catId, 0);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update verse');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!catId || !deleteVerse) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/verse-categories/${catId}/verses?verse_id=${deleteVerse.id}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (res.ok) {
        toast.success('Verse deleted');
        setDeleteVerse(null);
        fetchVerses(catId, 0);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete verse');
    } finally {
      setDeleting(false);
    }
  };

  const toggleAiSelection = (ref: string) => {
    setAiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) {
        next.delete(ref);
      } else {
        next.add(ref);
      }
      return next;
    });
  };

  const hasMore = verses.length < total;
  const selectedCategory = categories.find((c) => c.id === catId);

  return (
    <div className="space-y-4">
      {/* Category selector */}
      <div className="flex items-end gap-4">
        <div className="w-72">
          <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
            Category
          </label>
          <select
            value={catId ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onCategoryChange(val ? parseInt(val, 10) : null);
            }}
            className={cn(
              'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text',
              'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
              'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
            )}
          >
            <option value="">Select a category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.verse_count ?? 0} verses)
              </option>
            ))}
          </select>
        </div>
        {selectedCategory && (
          <p className="pb-2 text-sm text-text-muted dark:text-text-muted-dark">
            {total} verse{total !== 1 ? 's' : ''} in {selectedCategory.name}
          </p>
        )}
      </div>

      {!catId ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
          <Search className="h-12 w-12 text-text-muted dark:text-text-muted-dark" />
          <p className="text-text-muted dark:text-text-muted-dark">
            Select a category above to manage its verses
          </p>
        </div>
      ) : (
        <>
          {/* Add verse section */}
          <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
            <h3 className="mb-3 text-sm font-semibold text-text dark:text-text-dark">
              Add Verse
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              {/* Manual add */}
              <div className="flex-1">
                <Input
                  label="Verse Reference"
                  placeholder='e.g., John 3:16 or Psalms 23:1-2'
                  value={addRef}
                  onChange={(e) => setAddRef(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddVerse()}
                  disabled={addingVerse}
                />
              </div>
              <Button
                onClick={handleAddVerse}
                loading={addingVerse}
                disabled={!addRef.trim()}
              >
                <Plus className="h-4 w-4" /> Add & Auto-Fetch
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowAI(!showAI)}
              >
                <Sparkles className="h-4 w-4" /> AI Generate
              </Button>
            </div>

            {/* AI Generation section */}
            {showAI && (
              <div className="mt-4 space-y-4 rounded-xl border border-border bg-slate-50 p-4 dark:border-border-dark dark:bg-slate-900">
                <div className="flex items-end gap-3">
                  <div className="w-32">
                    <Input
                      label="Count"
                      type="number"
                      min={1}
                      max={50}
                      value={aiCount}
                      onChange={(e) => setAiCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      disabled={aiLoading || aiSaving}
                    />
                  </div>
                  <Button
                    onClick={handleAIGenerate}
                    loading={aiLoading}
                    disabled={aiSaving}
                  >
                    <Sparkles className="h-4 w-4" /> Generate
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => { setShowAI(false); setAiSuggestions([]); setAiSelected(new Set()); }}
                    disabled={aiLoading || aiSaving}
                  >
                    Cancel
                  </Button>
                </div>

                {/* AI results */}
                {aiSuggestions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-text dark:text-text-dark">
                        Suggestions ({aiSuggestions.length})
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAiSelected(new Set(aiSuggestions))}
                          className="text-xs text-primary hover:underline"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiSelected(new Set())}
                          className="text-xs text-text-muted hover:underline dark:text-text-muted-dark"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-border dark:border-border-dark">
                      {aiSuggestions.map((ref) => (
                        <label
                          key={ref}
                          className="flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-hover dark:hover:bg-surface-hover-dark"
                        >
                          <input
                            type="checkbox"
                            checked={aiSelected.has(ref)}
                            onChange={() => toggleAiSelection(ref)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-text dark:text-text-dark">{ref}</span>
                        </label>
                      ))}
                    </div>

                    {/* Save progress */}
                    {aiSaving && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-text-muted dark:text-text-muted-dark">
                          <span>Saving verses...</span>
                          <span>{aiSaveProgress.current}/{aiSaveProgress.total}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{
                              width: `${aiSaveProgress.total > 0 ? (aiSaveProgress.current / aiSaveProgress.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleSaveAISelected}
                      loading={aiSaving}
                      disabled={aiSelected.size === 0}
                    >
                      Save Selected ({aiSelected.size})
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Verses list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
                  <Skeleton height={14} className="w-1/5" />
                  <Skeleton height={14} className="w-1/3" />
                  <Skeleton height={14} className="w-16" />
                </div>
              ))}
            </div>
          ) : verses.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
              <BookOpen className="h-12 w-12 text-text-muted dark:text-text-muted-dark" />
              <p className="text-text-muted dark:text-text-muted-dark">
                No verses in this category yet. Add one manually or use AI Generate.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border dark:border-border-dark">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-hover/50 dark:border-border-dark dark:bg-surface-hover-dark/50">
                    <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">Reference</th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">Book</th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">Text</th>
                    <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Translations</th>
                    <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Reactions</th>
                    <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Comments</th>
                    <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-text-muted-dark">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-border-dark">
                  {verses.map((v) => (
                    <tr
                      key={v.id}
                      className="bg-surface transition-colors hover:bg-surface-hover/30 dark:bg-surface-dark dark:hover:bg-surface-hover-dark/30"
                    >
                      <td className="px-4 py-3 font-medium text-text dark:text-text-dark whitespace-nowrap">
                        {v.verse_reference}
                      </td>
                      <td className="px-4 py-3 text-text-muted dark:text-text-muted-dark whitespace-nowrap">
                        {v.book}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-text-muted dark:text-text-muted-dark">
                        <p className="line-clamp-2 text-xs">{v.content_text}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-text dark:text-text-dark">
                        {v.translations?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted dark:text-text-muted-dark">
                        {v.reaction_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted dark:text-text-muted-dark">
                        {v.comment_count ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditVerse(v);
                              setEditRef(v.verse_reference);
                              setEditText(v.content_text);
                            }}
                            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteVerse(v)}
                            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500 dark:text-text-muted-dark dark:hover:bg-red-500/10"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Load More */}
          {hasMore && !loading && (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                onClick={() => fetchVerses(catId!, offset + LIMIT, true)}
                loading={loadingMore}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit Verse Modal */}
      <Modal
        isOpen={editVerse !== null}
        onClose={() => setEditVerse(null)}
        title="Edit Verse"
        size="lg"
      >
        {editVerse && (
          <div className="space-y-4">
            <Input
              label="Verse Reference"
              value={editRef}
              onChange={(e) => setEditRef(e.target.value)}
              disabled={editSaving}
            />
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                Content Text (KJV)
              </label>
              <textarea
                rows={4}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                disabled={editSaving}
                className={cn(
                  'w-full rounded-xl border border-border bg-surface px-4 py-3 text-text transition-colors placeholder:text-text-muted',
                  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                  'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
                  'resize-none'
                )}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSaveEdit} loading={editSaving} disabled={!editRef.trim()}>
                Save Changes
              </Button>
              <Button variant="secondary" onClick={() => setEditVerse(null)} disabled={editSaving}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteVerse !== null}
        onClose={() => setDeleteVerse(null)}
        title="Delete Verse"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-text dark:text-text-dark">
              {deleteVerse?.verse_reference}
            </span>
            ? This will also remove all translations, reactions, and comments.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteVerse(null)} disabled={deleting} className="flex-1">
              Keep
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">
              Delete Verse
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Media
// ---------------------------------------------------------------------------

function MediaTab({
  categories,
  selectedCategoryId,
  onCategoryChange,
}: {
  categories: VerseCategory[];
  selectedCategoryId: number | null;
  onCategoryChange: (id: number | null) => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [shared, setShared] = useState(false);

  // Delete state
  const [deleteMedia, setDeleteMedia] = useState<MediaRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Use a default category ID for media API calls -- 'shared' view uses first category
  const mediaCatId = selectedCategoryId || (categories.length > 0 ? categories[0].id : null);

  const fetchMedia = useCallback(async (categoryId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verse-categories/${categoryId}/media?limit=200`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMedia(data.media || []);
        setTotal(data.total || 0);
      } else {
        toast.error('Failed to load media');
      }
    } catch {
      toast.error('Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (mediaCatId) {
      fetchMedia(mediaCatId);
    }
  }, [mediaCatId, fetchMedia]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !mediaCatId) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });

      try {
        // Step 1: Get presigned URL
        const params = new URLSearchParams({
          type: 'category-media',
          contentType: file.type,
        });
        const presignRes = await fetch(`/api/upload/presigned?${params}`, {
          credentials: 'include',
        });
        if (!presignRes.ok) {
          const data = await presignRes.json();
          console.error('[media-upload] Presign failed:', data.error);
          errorCount++;
          continue;
        }

        const { uploadUrl, key, publicUrl } = await presignRes.json();

        // Step 2: Upload file to B2
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!uploadRes.ok) {
          console.error('[media-upload] B2 upload failed:', uploadRes.status);
          errorCount++;
          continue;
        }

        // Step 3: Create media record
        const createRes = await fetch(`/api/admin/verse-categories/${mediaCatId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            media_url: publicUrl,
            media_key: key,
            shared,
          }),
        });
        if (createRes.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        console.error('[media-upload] Error:', err);
        errorCount++;
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} image${successCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
      fetchMedia(mediaCatId);
    } else {
      toast.error('Failed to upload images');
    }
  };

  const handleDelete = async () => {
    if (!deleteMedia || !mediaCatId) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/verse-categories/${mediaCatId}/media?media_id=${deleteMedia.id}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (res.ok) {
        toast.success('Media deleted');
        setDeleteMedia(null);
        fetchMedia(mediaCatId);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex items-end gap-4">
        <div className="w-72">
          <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
            Category Filter
          </label>
          <select
            value={selectedCategoryId ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onCategoryChange(val ? parseInt(val, 10) : null);
            }}
            className={cn(
              'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text',
              'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
              'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
            )}
          >
            <option value="">All categories (shared + specific)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <p className="pb-2 text-sm text-text-muted dark:text-text-muted-dark">
          {total} media item{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Upload section */}
      <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
        <h3 className="mb-3 text-sm font-semibold text-text dark:text-text-dark">
          Upload Images
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => handleUpload(e.target.files)}
              disabled={uploading || !mediaCatId}
              className="block w-full text-sm text-text file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20 dark:text-text-dark"
            />
          </div>
          <label className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-text dark:text-text-dark">Shared (all categories)</span>
          </label>
        </div>

        {/* Upload progress */}
        {uploading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-text-muted dark:text-text-muted-dark">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </span>
              <span>{uploadProgress.current}/{uploadProgress.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Media grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} height={160} className="rounded-xl" />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
          <ImageIcon className="h-12 w-12 text-text-muted dark:text-text-muted-dark" />
          <p className="text-text-muted dark:text-text-muted-dark">
            No media uploaded yet. Upload background images above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {media.map((m) => (
            <div
              key={m.id}
              className="group relative overflow-hidden rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="aspect-[3/4] w-full">
                <img
                  src={m.media_url}
                  alt={m.media_key}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* Overlay */}
              <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex justify-end p-2">
                  <button
                    type="button"
                    onClick={() => setDeleteMedia(m)}
                    className="rounded-lg bg-red-500/90 p-1.5 text-white transition-colors hover:bg-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-2">
                  {m.category_id === null ? (
                    <span className="inline-block rounded bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                      Shared
                    </span>
                  ) : m.category ? (
                    <span className="inline-block rounded bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                      {m.category.name}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteMedia !== null}
        onClose={() => setDeleteMedia(null)}
        title="Delete Media"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            Are you sure you want to remove this media from the database? The file in storage will not be deleted.
          </p>
          {deleteMedia && (
            <div className="overflow-hidden rounded-lg border border-border dark:border-border-dark">
              <img
                src={deleteMedia.media_url}
                alt={deleteMedia.media_key}
                className="h-40 w-full object-cover"
              />
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteMedia(null)} disabled={deleting} className="flex-1">
              Keep
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
