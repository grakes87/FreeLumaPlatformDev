'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Save,
  Trash2,
  X,
  Mail,
  Phone,
  Globe,
  MapPin,
  ArrowRightLeft,
  MessageSquare,
  Microscope,
  Package,
  UserPlus,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PipelineStage =
  | 'new_lead'
  | 'contacted'
  | 'engaged'
  | 'sample_requested'
  | 'sample_sent'
  | 'converted'
  | 'lost';

type ActivityType =
  | 'stage_change'
  | 'email_sent'
  | 'email_opened'
  | 'email_clicked'
  | 'note_added'
  | 'sample_shipped'
  | 'converted'
  | 'created'
  | 'scrape_completed'
  | 'ai_researched';

interface ChurchData {
  id: number;
  name: string;
  pastor_name: string | null;
  staff_names: string[] | null;
  denomination: string | null;
  congregation_size_estimate: string | null;
  youth_programs: string[] | null;
  service_times: string[] | null;
  website_url: string | null;
  social_media: Record<string, string> | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  pipeline_stage: PipelineStage;
  ai_summary: string | null;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivityData {
  id: number;
  church_id: number;
  activity_type: ActivityType;
  description: string | null;
  metadata: Record<string, unknown> | null;
  admin_id: number | null;
  created_at: string;
}

interface ChurchDetailModalProps {
  churchId: number;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIPELINE_STAGES: { value: PipelineStage; label: string; color: string }[] = [
  { value: 'new_lead', label: 'New Lead', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-indigo-500' },
  { value: 'engaged', label: 'Engaged', color: 'bg-purple-500' },
  { value: 'sample_requested', label: 'Sample Requested', color: 'bg-amber-500' },
  { value: 'sample_sent', label: 'Sample Sent', color: 'bg-orange-500' },
  { value: 'converted', label: 'Converted', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-gray-400' },
];

const ACTIVITY_ICONS: Record<ActivityType, React.ElementType> = {
  stage_change: ArrowRightLeft,
  email_sent: Mail,
  email_opened: Mail,
  email_clicked: Mail,
  note_added: MessageSquare,
  sample_shipped: Package,
  converted: UserPlus,
  created: UserPlus,
  scrape_completed: Microscope,
  ai_researched: Microscope,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChurchDetailModal({
  churchId,
  isOpen,
  onClose,
  onUpdate,
}: ChurchDetailModalProps) {
  const toast = useToast();

  const [church, setChurch] = useState<ChurchData | null>(null);
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Editable fields
  const [form, setForm] = useState({
    name: '',
    pastor_name: '',
    denomination: '',
    congregation_size_estimate: '',
    contact_email: '',
    contact_phone: '',
    website_url: '',
    address_line1: '',
    city: '',
    state: '',
    zip_code: '',
    pipeline_stage: 'new_lead' as PipelineStage,
    notes: '',
    youth_programs: [] as string[],
  });
  const [newYouthProgram, setNewYouthProgram] = useState('');

  // ---------------------------------------------------------------------------
  // Fetch church details
  // ---------------------------------------------------------------------------

  const fetchChurch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/church-outreach/churches/${churchId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch church');
      const json = await res.json();
      const data = json.data ?? json;

      setChurch(data.church);
      setActivities(data.activities || []);

      // Populate form
      const c = data.church;
      setForm({
        name: c.name || '',
        pastor_name: c.pastor_name || '',
        denomination: c.denomination || '',
        congregation_size_estimate: c.congregation_size_estimate || '',
        contact_email: c.contact_email || '',
        contact_phone: c.contact_phone || '',
        website_url: c.website_url || '',
        address_line1: c.address_line1 || '',
        city: c.city || '',
        state: c.state || '',
        zip_code: c.zip_code || '',
        pipeline_stage: c.pipeline_stage,
        notes: c.notes || '',
        youth_programs: c.youth_programs || [],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load church');
    } finally {
      setLoading(false);
    }
  }, [churchId, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchChurch();
    }
  }, [isOpen, fetchChurch]);

  // ---------------------------------------------------------------------------
  // Save handler
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        pastor_name: form.pastor_name || null,
        denomination: form.denomination || null,
        congregation_size_estimate: form.congregation_size_estimate || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        website_url: form.website_url || null,
        address_line1: form.address_line1 || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        pipeline_stage: form.pipeline_stage,
        notes: form.notes || null,
        youth_programs: form.youth_programs.length > 0 ? form.youth_programs : null,
      };

      const res = await fetch(`/api/admin/church-outreach/churches/${churchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(err.error || 'Save failed');
      }

      toast.success('Church updated');
      onUpdate();
      fetchChurch(); // Refresh to show new activity entries
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, churchId, toast, onUpdate, fetchChurch]);

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/church-outreach/churches/${churchId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok && res.status !== 204) {
        throw new Error('Delete failed');
      }

      toast.success('Church deleted');
      onUpdate();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }, [churchId, toast, onUpdate, onClose]);

  // ---------------------------------------------------------------------------
  // Youth programs helpers
  // ---------------------------------------------------------------------------

  const addYouthProgram = useCallback(() => {
    const trimmed = newYouthProgram.trim();
    if (!trimmed) return;
    setForm((prev) => ({
      ...prev,
      youth_programs: [...prev.youth_programs, trimmed],
    }));
    setNewYouthProgram('');
  }, [newYouthProgram]);

  const removeYouthProgram = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      youth_programs: prev.youth_programs.filter((_, i) => i !== index),
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Form update helper
  // ---------------------------------------------------------------------------

  const updateField = useCallback(
    (field: keyof typeof form, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={church?.name || 'Church Details'} size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !church ? (
        <p className="py-8 text-center text-text-muted dark:text-text-muted-dark">
          Church not found
        </p>
      ) : (
        <div className="space-y-6">
          {/* Pipeline stage selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-text dark:text-text-dark">
              Pipeline Stage
            </label>
            <div className="flex flex-wrap gap-2">
              {PIPELINE_STAGES.map((stage) => (
                <button
                  key={stage.value}
                  onClick={() => updateField('pipeline_stage', stage.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    form.pipeline_stage === stage.value
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                      : 'bg-surface-hover text-text-muted hover:text-text dark:bg-surface-hover-dark dark:text-text-muted-dark dark:hover:text-text-dark'
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', stage.color)} />
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          {/* Two column layout on desktop */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Editable fields */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
                Church Information
              </h4>

              <Field
                label="Name"
                value={form.name}
                onChange={(v) => updateField('name', v)}
                required
              />
              <Field
                label="Pastor"
                value={form.pastor_name}
                onChange={(v) => updateField('pastor_name', v)}
                icon={<UserPlus className="h-4 w-4" />}
              />
              <Field
                label="Denomination"
                value={form.denomination}
                onChange={(v) => updateField('denomination', v)}
              />
              <Field
                label="Congregation Size"
                value={form.congregation_size_estimate}
                onChange={(v) => updateField('congregation_size_estimate', v)}
              />
              <Field
                label="Email"
                value={form.contact_email}
                onChange={(v) => updateField('contact_email', v)}
                type="email"
                icon={<Mail className="h-4 w-4" />}
              />
              <Field
                label="Phone"
                value={form.contact_phone}
                onChange={(v) => updateField('contact_phone', v)}
                icon={<Phone className="h-4 w-4" />}
              />
              <Field
                label="Website"
                value={form.website_url}
                onChange={(v) => updateField('website_url', v)}
                icon={<Globe className="h-4 w-4" />}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Address"
                  value={form.address_line1}
                  onChange={(v) => updateField('address_line1', v)}
                  icon={<MapPin className="h-4 w-4" />}
                />
                <Field
                  label="City"
                  value={form.city}
                  onChange={(v) => updateField('city', v)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="State"
                  value={form.state}
                  onChange={(v) => updateField('state', v)}
                />
                <Field
                  label="ZIP"
                  value={form.zip_code}
                  onChange={(v) => updateField('zip_code', v)}
                />
              </div>

              {/* Youth programs as tags */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                  Youth Programs
                </label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {form.youth_programs.map((prog, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    >
                      {prog}
                      <button
                        onClick={() => removeYouthProgram(i)}
                        className="ml-0.5 hover:text-purple-900 dark:hover:text-purple-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newYouthProgram}
                    onChange={(e) => setNewYouthProgram(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addYouthProgram();
                      }
                    }}
                    placeholder="Add program..."
                    className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark"
                  />
                  <button
                    onClick={addYouthProgram}
                    className="rounded-lg bg-surface-hover px-3 py-1.5 text-sm font-medium text-text hover:bg-primary hover:text-white dark:bg-surface-hover-dark dark:text-text-dark"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Social media links */}
              {church.social_media && Object.keys(church.social_media).length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                    Social Media
                  </label>
                  <div className="space-y-1">
                    {Object.entries(church.social_media).map(([platform, url]) => (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="capitalize">{platform}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark"
                  placeholder="Admin notes..."
                />
              </div>

              {/* AI Summary (read-only) */}
              {church.ai_summary && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                    AI Summary
                  </label>
                  <p className="rounded-lg bg-surface-hover p-3 text-sm italic text-text-muted dark:bg-surface-hover-dark dark:text-text-muted-dark">
                    {church.ai_summary}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Activity timeline */}
            <div>
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
                Activity Timeline
              </h4>
              {activities.length === 0 ? (
                <p className="text-sm text-text-muted dark:text-text-muted-dark">
                  No activity recorded yet
                </p>
              ) : (
                <div className="relative space-y-0 pl-6">
                  {/* Vertical line */}
                  <div className="absolute bottom-0 left-2.5 top-0 w-px bg-border dark:bg-border-dark" />

                  {activities.map((activity) => {
                    const Icon =
                      ACTIVITY_ICONS[activity.activity_type as ActivityType] || MessageSquare;
                    return (
                      <div key={activity.id} className="relative pb-4">
                        {/* Dot */}
                        <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface-hover dark:bg-surface-hover-dark">
                          <Icon className="h-3 w-3 text-text-muted dark:text-text-muted-dark" />
                        </div>

                        <div>
                          <p className="text-sm font-medium text-text dark:text-text-dark">
                            {formatActivityType(activity.activity_type)}
                          </p>
                          {activity.description && (
                            <p className="text-xs text-text-muted dark:text-text-muted-dark">
                              {activity.description}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs text-text-muted/60 dark:text-text-muted-dark/60">
                            {formatDate(activity.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between border-t border-border pt-4 dark:border-border-dark">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Delete this church and all related data?
                </div>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ChurchDetailModal;

// ---------------------------------------------------------------------------
// Field sub-component
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted dark:text-text-muted-dark">
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full rounded-lg border border-border bg-surface py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
            icon ? 'pl-9 pr-3' : 'px-3'
          )}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatActivityType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
