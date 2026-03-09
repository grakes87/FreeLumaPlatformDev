'use client';

import { useState, useRef, useCallback } from 'react';
import { Loader2, Eye, Code, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Template {
  id: number;
  name: string;
  subject: string;
  html_body: string;
  merge_fields: string[] | null;
  is_default: boolean;
}

interface TemplateEditorProps {
  template?: Template | null;
  onSave: (template: Template) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MERGE_FIELDS = [
  'PastorName',
  'ChurchName',
  'City',
  'State',
  'Denomination',
  'ContactName',
] as const;

const SAMPLE_CHURCH = {
  PastorName: 'Pastor John Smith',
  ChurchName: 'Grace Community Church',
  City: 'Nashville',
  State: 'TN',
  Denomination: 'Baptist',
  ContactName: 'John Smith',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [htmlBody, setHtmlBody] = useState(template?.html_body || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedRef = useRef<'subject' | 'body'>('body');

  // Track which field was last focused
  const handleSubjectFocus = useCallback(() => {
    lastFocusedRef.current = 'subject';
  }, []);

  const handleBodyFocus = useCallback(() => {
    lastFocusedRef.current = 'body';
  }, []);

  // Insert merge field at cursor position
  const insertMergeField = useCallback((field: string) => {
    const mergeTag = `{${field}}`;

    if (lastFocusedRef.current === 'subject' && subjectRef.current) {
      const input = subjectRef.current;
      const start = input.selectionStart ?? subject.length;
      const end = input.selectionEnd ?? subject.length;
      const newValue = subject.slice(0, start) + mergeTag + subject.slice(end);
      setSubject(newValue);
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        input.setSelectionRange(start + mergeTag.length, start + mergeTag.length);
        input.focus();
      });
    } else if (bodyRef.current) {
      const textarea = bodyRef.current;
      const start = textarea.selectionStart ?? htmlBody.length;
      const end = textarea.selectionEnd ?? htmlBody.length;
      const newValue = htmlBody.slice(0, start) + mergeTag + htmlBody.slice(end);
      setHtmlBody(newValue);
      requestAnimationFrame(() => {
        textarea.setSelectionRange(start + mergeTag.length, start + mergeTag.length);
        textarea.focus();
      });
    }
  }, [subject, htmlBody]);

  // Render preview with sample data
  const renderPreview = useCallback((text: string) => {
    let result = text;
    for (const [key, value] of Object.entries(SAMPLE_CHURCH)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }, []);

  // Save template
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }
    if (!htmlBody.trim()) {
      setError('HTML body is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = template
        ? `/api/admin/church-outreach/templates/${template.id}`
        : '/api/admin/church-outreach/templates';

      const method = template ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          subject: subject.trim(),
          html_body: htmlBody,
          merge_fields: MERGE_FIELDS.filter((f) => htmlBody.includes(`{${f}}`) || subject.includes(`{${f}}`)),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to ${template ? 'update' : 'create'} template`);
      }

      const data = await res.json();
      onSave(data.data?.template ?? data.template);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onCancel} title={template ? 'Edit Template' : 'New Template'} size="xl">
      <div className="space-y-4">
        {/* Template name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
            Template Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Follow-Up After Sample"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        </div>

        {/* Merge field buttons */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted dark:text-text-muted-dark">
            Insert Merge Field
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MERGE_FIELDS.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => insertMergeField(field)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 dark:border-border-dark"
              >
                <Plus className="h-3 w-3" />
                {`{${field}}`}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
            Email Subject
          </label>
          <input
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={handleSubjectFocus}
            placeholder="e.g. Free Luma Bracelets for {ChurchName}"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        </div>

        {/* Toggle: Edit / Preview */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode(false)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              !previewMode
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            <Code className="h-3.5 w-3.5" />
            Edit HTML
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode(true)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              previewMode
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
          {previewMode && (
            <span className="text-xs text-text-muted dark:text-text-muted-dark">
              Subject: {renderPreview(subject) || '(no subject)'}
            </span>
          )}
        </div>

        {/* HTML body editor / preview */}
        {previewMode ? (
          <div
            className="min-h-[300px] rounded-lg border border-border bg-white p-4 dark:border-border-dark dark:bg-gray-50"
            dangerouslySetInnerHTML={{ __html: renderPreview(htmlBody) }}
          />
        ) : (
          <textarea
            ref={bodyRef}
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            onFocus={handleBodyFocus}
            rows={20}
            placeholder="<div>Your email HTML here...</div>"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {template ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export { TemplateEditor };
