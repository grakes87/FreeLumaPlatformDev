'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkshopNotesProps {
  workshopId: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 2000;
const MAX_CHARS = 50000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Personal notes panel for in-workshop note-taking.
 * Auto-saves with 2s debounce to PUT /api/workshops/[id]/notes.
 * Flushes unsaved changes on unmount.
 */
export function WorkshopNotes({ workshopId }: WorkshopNotesProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const contentRef = useRef(content);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Keep contentRef in sync
  contentRef.current = content;

  // ---- Save function ----

  const saveNotes = useCallback(
    async (text: string) => {
      if (!mountedRef.current) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/workshops/${workshopId}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: text }),
        });

        if (res.ok && mountedRef.current) {
          setLastSaved(new Date());
          dirtyRef.current = false;
        }
      } catch (err) {
        console.error('[WorkshopNotes] save error:', err);
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [workshopId]
  );

  // ---- Debounced save scheduler ----

  const scheduleSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      saveNotes(contentRef.current);
    }, DEBOUNCE_MS);
  }, [saveNotes]);

  // ---- Handle content change ----

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, MAX_CHARS);
    setContent(value);
    dirtyRef.current = true;
    scheduleSave();
  };

  // ---- Load existing notes on mount ----

  useEffect(() => {
    mountedRef.current = true;

    async function loadNotes() {
      try {
        const res = await fetch(`/api/workshops/${workshopId}/notes`, {
          credentials: 'include',
        });
        if (!res.ok) return;

        const json = await res.json();
        if (json.note && mountedRef.current) {
          setContent(json.note.content || '');
          contentRef.current = json.note.content || '';
        }
      } catch (err) {
        console.error('[WorkshopNotes] load error:', err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    loadNotes();

    // Flush unsaved changes on unmount
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (dirtyRef.current) {
        // Fire-and-forget save on unmount
        fetch(`/api/workshops/${workshopId}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: contentRef.current }),
        }).catch(() => {});
      }
    };
  }, [workshopId]);

  // ---- Save indicator text ----

  const saveIndicator = () => {
    if (saving) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </span>
      );
    }
    if (lastSaved) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-400">
          <Check className="h-3 w-3" />
          Saved
        </span>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-700 px-3 py-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">My Notes</h3>
        </div>
        {saveIndicator()}
      </div>

      {/* Notes area */}
      <div className="flex-1 p-2">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={handleChange}
            placeholder="Take notes during the workshop..."
            maxLength={MAX_CHARS}
            className={cn(
              'h-full w-full resize-none rounded-lg border border-slate-700 bg-slate-800 p-3',
              'font-sans text-sm leading-relaxed text-slate-200 placeholder-slate-500',
              'outline-none transition-colors focus:border-primary'
            )}
          />
        )}
      </div>

      {/* Character count */}
      <div className="flex-shrink-0 border-t border-slate-700 px-3 py-1">
        <p
          className={cn(
            'text-right text-[10px]',
            content.length > 48000 ? 'text-amber-400' : 'text-slate-600'
          )}
        >
          {content.length.toLocaleString()}/{MAX_CHARS.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
