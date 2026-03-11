'use client';

import { useState, useRef, useCallback } from 'react';
import { Loader2, Eye, Code, Plus, Upload, X, Image as ImageIcon, Video } from 'lucide-react';
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
  template_assets: Record<string, string> | null;
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

/** Image-only asset slots */
const IMAGE_SLOTS = [
  { key: 'LogoUrl', label: 'Logo', hint: 'Header logo image' },
  { key: 'HeroImageUrl', label: 'Bracelet Photo', hint: 'Main product photo' },
] as const;

const SAMPLE_CHURCH = {
  PastorName: 'Pastor John Smith',
  ChurchName: 'Grace Community Church',
  City: 'Nashville',
  State: 'TN',
  Denomination: 'Baptist',
  ContactName: 'John Smith',
};

/** All asset keys for preview replacement (includes both video keys) */
const ALL_ASSET_KEYS = [
  ...IMAGE_SLOTS.map((s) => s.key),
  'VideoUrl',
  'VideoThumbnailUrl',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the first frame of a video File as a JPEG Blob */
function extractVideoThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const objUrl = URL.createObjectURL(file);
    video.src = objUrl;

    video.onloadeddata = () => {
      // Seek slightly into the video to avoid a blank first frame
      video.currentTime = 0.1;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objUrl);
            if (blob) resolve(blob);
            else reject(new Error('Failed to create thumbnail'));
          },
          'image/jpeg',
          0.85
        );
      } catch (err) {
        URL.revokeObjectURL(objUrl);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Failed to load video'));
    };
  });
}

/** Upload a file (or Blob) to B2 via presigned URL */
async function uploadToB2(file: File | Blob, contentType: string): Promise<string> {
  const presignRes = await fetch(
    `/api/upload/presigned?type=outreach-assets&contentType=${encodeURIComponent(contentType)}`,
    { credentials: 'include' }
  );
  if (!presignRes.ok) {
    const errData = await presignRes.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to get upload URL');
  }
  const { uploadUrl, publicUrl } = await presignRes.json();

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!uploadRes.ok) throw new Error('Upload failed');

  return publicUrl;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [htmlBody, setHtmlBody] = useState(template?.html_body || '');
  const [templateAssets, setTemplateAssets] = useState<Record<string, string>>(
    template?.template_assets || {}
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedRef = useRef<'subject' | 'body'>('body');

  const handleSubjectFocus = useCallback(() => { lastFocusedRef.current = 'subject'; }, []);
  const handleBodyFocus = useCallback(() => { lastFocusedRef.current = 'body'; }, []);

  // Insert merge field at cursor position
  const insertMergeField = useCallback((field: string) => {
    const mergeTag = `{${field}}`;
    if (lastFocusedRef.current === 'subject' && subjectRef.current) {
      const input = subjectRef.current;
      const start = input.selectionStart ?? subject.length;
      const end = input.selectionEnd ?? subject.length;
      const newValue = subject.slice(0, start) + mergeTag + subject.slice(end);
      setSubject(newValue);
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

  // Upload image asset
  const handleImageUpload = useCallback(async (slotKey: string, file: File) => {
    setUploadingSlot(slotKey);
    setError(null);
    try {
      const publicUrl = await uploadToB2(file, file.type);
      setTemplateAssets((prev) => ({ ...prev, [slotKey]: publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingSlot(null);
    }
  }, []);

  // Upload video (mp4) or GIF for the video slot
  const handleVideoUpload = useCallback(async (file: File) => {
    setUploadingSlot('VideoUrl');
    setError(null);
    try {
      const isGif = file.type === 'image/gif';

      // Upload the file
      const publicUrl = await uploadToB2(file, file.type);

      if (isGif) {
        // GIF: use as both VideoUrl and VideoThumbnailUrl (autoplays inline in email)
        setTemplateAssets((prev) => ({
          ...prev,
          VideoUrl: publicUrl,
          VideoThumbnailUrl: publicUrl,
        }));
      } else {
        // Video: extract first frame as thumbnail
        const thumbBlob = await extractVideoThumbnail(file);
        const thumbPublicUrl = await uploadToB2(thumbBlob, 'image/jpeg');
        setTemplateAssets((prev) => ({
          ...prev,
          VideoUrl: publicUrl,
          VideoThumbnailUrl: thumbPublicUrl,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingSlot(null);
    }
  }, []);

  // Remove asset from slot
  const removeAsset = useCallback((slotKey: string) => {
    setTemplateAssets((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  }, []);

  // Remove video (clears both VideoUrl and VideoThumbnailUrl)
  const removeVideo = useCallback(() => {
    setTemplateAssets((prev) => {
      const next = { ...prev };
      delete next.VideoUrl;
      delete next.VideoThumbnailUrl;
      return next;
    });
  }, []);

  // Render preview with sample data + asset URLs
  const renderPreview = useCallback((text: string) => {
    let result = text;
    for (const [key, value] of Object.entries(SAMPLE_CHURCH)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    for (const key of ALL_ASSET_KEYS) {
      if (templateAssets[key]) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), templateAssets[key]);
      }
    }
    return result;
  }, [templateAssets]);

  // Save template
  const handleSave = async () => {
    if (!name.trim()) { setError('Template name is required'); return; }
    if (!subject.trim()) { setError('Subject is required'); return; }
    if (!htmlBody.trim()) { setError('HTML body is required'); return; }

    setSaving(true);
    setError(null);

    try {
      const url = template
        ? `/api/admin/church-outreach/templates/${template.id}`
        : '/api/admin/church-outreach/templates';

      const assetsToSave = Object.keys(templateAssets).length > 0 ? templateAssets : null;

      const res = await fetch(url, {
        method: template ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          subject: subject.trim(),
          html_body: htmlBody,
          merge_fields: MERGE_FIELDS.filter((f) => htmlBody.includes(`{${f}}`) || subject.includes(`{${f}}`)),
          template_assets: assetsToSave,
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

  const videoThumb = templateAssets.VideoThumbnailUrl;
  const isVideoUploading = uploadingSlot === 'VideoUrl';

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

        {/* Asset Slots */}
        <div>
          <label className="mb-2 block text-sm font-medium text-text dark:text-text-dark">
            <ImageIcon className="mr-1.5 inline h-4 w-4" />
            Template Assets
          </label>

          {/* Image slots grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {IMAGE_SLOTS.map((slot) => {
              const url = templateAssets[slot.key];
              const isUploading = uploadingSlot === slot.key;
              return (
                <div
                  key={slot.key}
                  className="rounded-lg border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark"
                >
                  <div className="mb-1.5 text-xs font-semibold text-text dark:text-text-dark">
                    {slot.label}
                  </div>
                  <div className="mb-2 text-[11px] text-text-muted dark:text-text-muted-dark">
                    {slot.hint}
                  </div>
                  {url ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={slot.label}
                        className="h-20 w-full rounded-md border border-border object-cover dark:border-border-dark"
                      />
                      <button
                        type="button"
                        onClick={() => removeAsset(slot.key)}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white shadow-sm hover:bg-red-600"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label
                      className={cn(
                        'flex h-20 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5 dark:border-border-dark',
                        isUploading && 'pointer-events-none opacity-50'
                      )}
                    >
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <>
                          <Upload className="mb-1 h-4 w-4 text-text-muted dark:text-text-muted-dark" />
                          <span className="text-[11px] text-text-muted dark:text-text-muted-dark">Upload</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(slot.key, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  <div className="mt-1.5 text-center">
                    <code className="text-[10px] text-text-muted dark:text-text-muted-dark">{`{${slot.key}}`}</code>
                  </div>
                </div>
              );
            })}

            {/* Video slot — special handling */}
            <div className="rounded-lg border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
              <div className="mb-1.5 text-xs font-semibold text-text dark:text-text-dark">
                <Video className="mr-1 inline h-3.5 w-3.5" />
                Video
              </div>
              <div className="mb-2 text-[11px] text-text-muted dark:text-text-muted-dark">
                See it in action clip
              </div>
              {videoThumb ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={videoThumb}
                    alt="Video thumbnail"
                    className="h-20 w-full rounded-md border border-border object-cover dark:border-border-dark"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50">
                      <div className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeVideo}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white shadow-sm hover:bg-red-600"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label
                  className={cn(
                    'flex h-20 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5 dark:border-border-dark',
                    isVideoUploading && 'pointer-events-none opacity-50'
                  )}
                >
                  {isVideoUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <>
                      <Upload className="mb-1 h-4 w-4 text-text-muted dark:text-text-muted-dark" />
                      <span className="text-[11px] text-text-muted dark:text-text-muted-dark">Upload mp4 or gif</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="video/mp4,image/gif"
                    className="hidden"
                    disabled={isVideoUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              <div className="mt-1.5 text-center">
                <code className="text-[10px] text-text-muted dark:text-text-muted-dark">{'{VideoUrl}'}</code>
              </div>
            </div>
          </div>
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
            <span className="ml-auto text-xs text-text-muted dark:text-text-muted-dark">
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
