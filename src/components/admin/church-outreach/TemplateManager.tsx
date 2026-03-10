'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Edit3, Trash2, FileText } from 'lucide-react';
import TemplateEditor from './TemplateEditor';

interface Template {
  id: number;
  name: string;
  subject: string;
  html_body: string;
  merge_fields: string[] | null;
  template_assets: Record<string, string> | null;
  is_default: boolean;
  created_at: string;
}

function parseMergeFields(fields: string[] | string | null): string[] {
  if (!fields) return [];
  if (Array.isArray(fields)) return fields;
  try { return JSON.parse(fields); } catch { return []; }
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null | 'new'>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/church-outreach/templates', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/church-outreach/templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Failed to delete template');
        return;
      }
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeleting(null);
    }
  };

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-4 h-12 w-12 text-text-muted dark:text-text-muted-dark" />
          <h3 className="text-lg font-semibold text-text dark:text-text-dark">No templates yet</h3>
          <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
            Create an HTML email template to use in drip sequences.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-text dark:text-text-dark">{t.name}</h4>
                  {t.is_default && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Default
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-text-muted dark:text-text-muted-dark">
                  Subject: {t.subject}
                </p>
                {parseMergeFields(t.merge_fields).length > 0 && (
                  <p className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark">
                    Merge fields: {parseMergeFields(t.merge_fields).map((f) => `{${f}}`).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5 ml-4">
                <button
                  onClick={() => setEditing(t)}
                  className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  title="Edit"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  title="Delete"
                >
                  {deleting === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          onSave={() => {
            setEditing(null);
            fetchTemplates();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
