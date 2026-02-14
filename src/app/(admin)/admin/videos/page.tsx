'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Eye,
  EyeOff,
  Trash2,
  Pencil,
  Star,
  Film,
  Clock,
  Play,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { VideoUploadForm } from '@/components/admin/VideoUploadForm';
import { VideoCategoryManager } from '@/components/admin/VideoCategoryManager';
import { cn } from '@/lib/utils/cn';

interface VideoCategory {
  id: number;
  name: string;
  slug: string;
}

interface Video {
  id: number;
  title: string;
  description: string | null;
  category_id: number;
  video_url: string;
  thumbnail_url: string | null;
  caption_url: string | null;
  duration_seconds: number;
  view_count: number;
  is_hero: boolean;
  published: boolean;
  created_at: string;
  category?: VideoCategory;
}

type Tab = 'videos' | 'categories';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AdminVideosPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('videos');
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number>(0);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVideos = useCallback(async () => {
    try {
      // Fetch all videos for admin (includes unpublished)
      const res = await fetch('/api/videos', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Videos API returns categories array with nested videos
        const allVideos: Video[] = [];
        if (data.categories) {
          for (const cat of data.categories) {
            for (const v of cat.videos) {
              allVideos.push({
                ...v,
                category: { id: cat.id, name: cat.name, slug: cat.slug },
              });
            }
          }
        }
        // Also check for unpublished videos that might not appear in categories
        // Use a separate admin-specific approach
        setVideos(allVideos);
      }
    } catch {
      toast.error('Failed to load videos');
    }
  }, [toast]);

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
      // silent
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchVideos(), fetchCategories()]);
    setLoading(false);
  }, [fetchVideos, fetchCategories]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleTogglePublished = async (video: Video) => {
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ published: !video.published }),
      });
      if (res.ok) {
        toast.success(
          video.published ? 'Video unpublished' : 'Video published'
        );
        fetchVideos();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update video');
    }
  };

  const handleSetHero = async (video: Video) => {
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_hero: !video.is_hero }),
      });
      if (res.ok) {
        toast.success(
          video.is_hero ? 'Hero badge removed' : 'Set as hero video'
        );
        fetchVideos();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update hero');
    }
  };

  const startEdit = (video: Video) => {
    setEditingId(video.id);
    setEditTitle(video.title);
    setEditDescription(video.description || '');
    setEditCategoryId(video.category_id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
    setEditCategoryId(0);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/videos/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          category_id: editCategoryId,
        }),
      });

      if (res.ok) {
        toast.success('Video updated');
        cancelEdit();
        fetchVideos();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update video');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Video deleted');
        setConfirmDeleteId(null);
        fetchVideos();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete video');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text-dark">
            Video Management
          </h1>
          <p className="text-text-muted dark:text-text-muted-dark">
            Upload, organize, and manage video content
          </p>
        </div>
        {tab === 'videos' && (
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4" /> Upload Video
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
        {(['videos', 'categories'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Videos Tab */}
      {tab === 'videos' && (
        <>
          {videos.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
              <Film className="h-12 w-12 text-text-muted dark:text-text-muted-dark" />
              <p className="text-text-muted dark:text-text-muted-dark">
                No videos yet. Upload your first video to get started.
              </p>
              <Button onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4" /> Upload Video
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
                >
                  {editingId === video.id ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <Input
                        label="Title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={savingEdit}
                      />
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                          Description
                        </label>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          disabled={savingEdit}
                          rows={2}
                          className={cn(
                            'w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text placeholder:text-text-muted',
                            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                            'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
                            'resize-none'
                          )}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                          Category
                        </label>
                        <select
                          value={editCategoryId}
                          onChange={(e) =>
                            setEditCategoryId(parseInt(e.target.value, 10))
                          }
                          disabled={savingEdit}
                          className={cn(
                            'w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text',
                            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                            'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                          )}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          loading={savingEdit}
                          disabled={!editTitle.trim()}
                        >
                          <Check className="h-4 w-4" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={cancelEdit}
                          disabled={savingEdit}
                        >
                          <X className="h-4 w-4" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Play className="h-8 w-8 text-text-muted dark:text-text-muted-dark" />
                          </div>
                        )}
                        {/* Duration overlay */}
                        {video.duration_seconds > 0 && (
                          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {formatDuration(video.duration_seconds)}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <h3 className="truncate font-semibold text-text dark:text-text-dark">
                            {video.title}
                          </h3>
                          {video.is_hero && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Hero
                            </span>
                          )}
                          {!video.published && (
                            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              Draft
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted dark:text-text-muted-dark">
                          {video.category && (
                            <span className="rounded bg-surface-hover px-2 py-0.5 dark:bg-surface-hover-dark">
                              {video.category.name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {video.view_count.toLocaleString()} views
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(video.duration_seconds)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-start gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(video)}
                          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(video)}
                          className={cn(
                            'rounded-lg p-2 transition-colors',
                            video.published
                              ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10'
                              : 'text-text-muted hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark'
                          )}
                          title={
                            video.published ? 'Unpublish' : 'Publish'
                          }
                        >
                          {video.published ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetHero(video)}
                          className={cn(
                            'rounded-lg p-2 transition-colors',
                            video.is_hero
                              ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                              : 'text-text-muted hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark'
                          )}
                          title={
                            video.is_hero
                              ? 'Remove hero badge'
                              : 'Set as hero'
                          }
                        >
                          <Star
                            className={cn(
                              'h-4 w-4',
                              video.is_hero && 'fill-amber-500'
                            )}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(video.id)}
                          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500 dark:text-text-muted-dark dark:hover:bg-red-500/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Categories Tab */}
      {tab === 'categories' && (
        <VideoCategoryManager onCategoriesChange={fetchCategories} />
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        title="Upload Video"
        size="lg"
      >
        <VideoUploadForm
          categories={categories}
          onSuccess={() => {
            setShowUpload(false);
            fetchAll();
          }}
          onCancel={() => setShowUpload(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete Video"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            Are you sure you want to delete this video? This action cannot be
            undone. All view progress and reactions will also be removed.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setConfirmDeleteId(null)}
              disabled={deleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                confirmDeleteId !== null && handleDelete(confirmDeleteId)
              }
              loading={deleting}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
