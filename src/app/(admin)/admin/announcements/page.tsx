'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Megaphone,
  Image as ImageIcon,
  Video,
  Upload,
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

interface Announcement {
  id: number;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  target_mode: 'all' | 'bible' | 'positivity';
  priority: number;
  active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_by: number;
  dismissal_count?: number;
  created_at: string;
  updated_at: string;
}

// Form state for create/edit
interface FormState {
  title: string;
  body: string;
  link_url: string;
  link_label: string;
  media_url: string;
  media_type: 'image' | 'video' | '';
  target_mode: 'all' | 'bible' | 'positivity';
  priority: number;
  active: boolean;
  starts_at: string;
  expires_at: string;
}

const emptyForm: FormState = {
  title: '',
  body: '',
  link_url: '',
  link_label: '',
  media_url: '',
  media_type: '',
  target_mode: 'all',
  priority: 0,
  active: true,
  starts_at: '',
  expires_at: '',
};

// ---------------------------------------------------------------------------
// Helper: format date for datetime-local input
// ---------------------------------------------------------------------------

function toLocalInput(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  // Format as YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isScheduleActive(ann: Announcement): boolean {
  const now = new Date();
  if (ann.starts_at && new Date(ann.starts_at) > now) return false;
  if (ann.expires_at && new Date(ann.expires_at) <= now) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminAnnouncementsPage() {
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteAnn, setDeleteAnn] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/announcements', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      } else {
        toast.error('Failed to load announcements');
      }
    } catch {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // ----- Modal helpers -----
  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (ann: Announcement) => {
    setEditId(ann.id);
    setForm({
      title: ann.title,
      body: ann.body,
      link_url: ann.link_url || '',
      link_label: ann.link_label || '',
      media_url: ann.media_url || '',
      media_type: ann.media_type || '',
      target_mode: ann.target_mode,
      priority: ann.priority,
      active: ann.active,
      starts_at: toLocalInput(ann.starts_at),
      expires_at: toLocalInput(ann.expires_at),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and body are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(editId ? { id: editId } : {}),
        title: form.title.trim(),
        body: form.body.trim(),
        link_url: form.link_url.trim() ? (/^https?:\/\//i.test(form.link_url.trim()) ? form.link_url.trim() : `https://${form.link_url.trim()}`) : null,
        link_label: form.link_label.trim() || null,
        media_url: form.media_url.trim() || null,
        media_type: form.media_type || null,
        target_mode: form.target_mode,
        priority: form.priority,
        active: form.active,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };

      const res = await fetch('/api/admin/announcements', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editId ? 'Announcement updated' : 'Announcement created');
        setShowModal(false);
        fetchAnnouncements();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (ann: Announcement) => {
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: ann.id, active: !ann.active }),
      });
      if (res.ok) {
        toast.success(`${ann.title} ${ann.active ? 'deactivated' : 'activated'}`);
        fetchAnnouncements();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async () => {
    if (!deleteAnn) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/announcements?id=${deleteAnn.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Announcement deleted');
        setDeleteAnn(null);
        fetchAnnouncements();
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

  // ----- Media upload -----
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Step 1: Get presigned URL
      const params = new URLSearchParams({
        type: 'announcement',
        contentType: file.type,
      });
      const presignRes = await fetch(`/api/upload/presigned?${params}`, {
        credentials: 'include',
      });
      if (!presignRes.ok) {
        const data = await presignRes.json();
        toast.error(data.error || 'Failed to get upload URL');
        return;
      }
      const { uploadUrl, publicUrl } = await presignRes.json();

      // Step 2: Upload to B2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        toast.error('Failed to upload file');
        return;
      }

      // Step 3: Update form
      const isVideo = file.type.startsWith('video/');
      setForm((f) => ({
        ...f,
        media_url: publicUrl,
        media_type: isVideo ? 'video' : 'image',
      }));
      toast.success('Media uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Mode badge color
  const modeBadge = (mode: string) => {
    switch (mode) {
      case 'bible':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'positivity':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text-dark">
            Announcements
          </h1>
          <p className="text-text-muted dark:text-text-muted-dark">
            Create popup messages for users. Each user sees an announcement once.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Announcement
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
              <Skeleton height={16} className="w-1/3" />
              <Skeleton height={16} className="w-16" />
              <Skeleton height={16} className="w-20" />
              <Skeleton height={16} className="w-16" />
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
          <Megaphone className="h-12 w-12 text-text-muted dark:text-text-muted-dark" />
          <p className="text-text-muted dark:text-text-muted-dark">
            No announcements yet. Create your first one to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border dark:border-border-dark">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/50 dark:border-border-dark dark:bg-surface-hover-dark/50">
                <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">Title</th>
                <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Target</th>
                <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Priority</th>
                <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Active</th>
                <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Schedule</th>
                <th className="px-4 py-3 text-center font-medium text-text-muted dark:text-text-muted-dark">Dismissed</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-text-muted-dark">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {announcements.map((ann) => {
                const scheduleOk = isScheduleActive(ann);
                return (
                  <tr
                    key={ann.id}
                    className="bg-surface transition-colors hover:bg-surface-hover/30 dark:bg-surface-dark dark:hover:bg-surface-hover-dark/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {ann.media_type === 'image' && <ImageIcon className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />}
                        {ann.media_type === 'video' && <Video className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />}
                        <div className="min-w-0">
                          <p className="font-medium text-text dark:text-text-dark truncate">{ann.title}</p>
                          <p className="text-xs text-text-muted dark:text-text-muted-dark line-clamp-1">{ann.body}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', modeBadge(ann.target_mode))}>
                        {ann.target_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-text dark:text-text-dark">
                      {ann.priority}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(ann)}
                        className={cn(
                          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                          ann.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                        )}
                        role="switch"
                        aria-checked={ann.active}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
                            ann.active ? 'translate-x-5' : 'translate-x-0'
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!ann.starts_at && !ann.expires_at ? (
                        <span className="text-xs text-text-muted dark:text-text-muted-dark">Always</span>
                      ) : (
                        <div className="text-xs">
                          {scheduleOk ? (
                            <span className="text-green-600 dark:text-green-400">In window</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">Outside window</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-text dark:text-text-dark">
                      {ann.dismissal_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(ann)}
                          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteAnn(ann)}
                          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500 dark:text-text-muted-dark dark:hover:bg-red-500/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => !saving && setShowModal(false)}
        title={editId ? 'Edit Announcement' : 'New Announcement'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="Announcement title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            disabled={saving}
            autoFocus
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Body
            </label>
            <textarea
              rows={4}
              placeholder="Announcement message..."
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              disabled={saving}
              className={cn(
                'w-full rounded-xl border border-border bg-surface px-4 py-3 text-text transition-colors placeholder:text-text-muted',
                'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
                'resize-none'
              )}
            />
          </div>

          {/* Media upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Media (optional)
            </label>
            {form.media_url ? (
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border dark:border-border-dark">
                  {form.media_type === 'video' ? (
                    <video src={form.media_url} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={form.media_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-text-muted dark:text-text-muted-dark">{form.media_url}</p>
                  <span className="text-xs capitalize text-text-muted dark:text-text-muted-dark">{form.media_type}</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, media_url: '', media_type: '' }))}
                  disabled={saving}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
                  onChange={handleFileSelect}
                  disabled={saving || uploading}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploading}
                  disabled={saving}
                >
                  <Upload className="h-4 w-4" /> Upload Image / Video
                </Button>
                <span className="text-xs text-text-muted dark:text-text-muted-dark">
                  or paste a URL:
                </span>
                <input
                  type="text"
                  placeholder="https://..."
                  value={form.media_url}
                  onChange={(e) => {
                    const url = e.target.value;
                    setForm((f) => ({
                      ...f,
                      media_url: url,
                      media_type: url.match(/\.(mp4|webm|mov)(\?|$)/i) ? 'video' : url ? 'image' : '',
                    }));
                  }}
                  disabled={saving}
                  className={cn(
                    'flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text',
                    'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50',
                    'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                  )}
                />
              </div>
            )}
          </div>

          {/* Link */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Link URL (optional)"
              placeholder="https://..."
              value={form.link_url}
              onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
              disabled={saving}
            />
            <Input
              label="Link Label"
              placeholder="Learn More"
              value={form.link_label}
              onChange={(e) => setForm((f) => ({ ...f, link_label: e.target.value }))}
              disabled={saving}
            />
          </div>

          {/* Target + Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                Target Mode
              </label>
              <select
                value={form.target_mode}
                onChange={(e) => setForm((f) => ({ ...f, target_mode: e.target.value as 'all' | 'bible' | 'positivity' }))}
                disabled={saving}
                className={cn(
                  'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text',
                  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                  'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                )}
              >
                <option value="all">All Users</option>
                <option value="bible">Bible Only</option>
                <option value="positivity">Positivity Only</option>
              </select>
            </div>
            <Input
              label="Priority"
              type="number"
              min={0}
              max={999}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
              disabled={saving}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                Active
              </label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                disabled={saving}
                className={cn(
                  'relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                  form.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                )}
                role="switch"
                aria-checked={form.active}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
                    form.active ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                Starts At (optional)
              </label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                disabled={saving}
                className={cn(
                  'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text',
                  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                  'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                )}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                Expires At (optional)
              </label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                disabled={saving}
                className={cn(
                  'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text',
                  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                  'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                )}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saving} disabled={!form.title.trim() || !form.body.trim()}>
              {editId ? 'Save Changes' : 'Create Announcement'}
            </Button>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteAnn !== null}
        onClose={() => setDeleteAnn(null)}
        title="Delete Announcement"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-text dark:text-text-dark">
              {deleteAnn?.title}
            </span>
            ? This will also remove all dismissal records.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteAnn(null)} disabled={deleting} className="flex-1">
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
