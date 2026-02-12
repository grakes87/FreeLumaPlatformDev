'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type DraftType = 'post' | 'prayer_request';

export interface DraftData {
  body: string;
  media_keys: string[];
  metadata: {
    category_id?: number;
    visibility?: 'public' | 'followers';
    is_anonymous?: boolean;
    prayer_privacy?: 'public' | 'followers' | 'private';
  };
}

interface DraftRecord extends DraftData {
  id: number;
  draft_type: DraftType;
  created_at: string;
  updated_at: string;
}

const EMPTY_DRAFT: DraftData = {
  body: '',
  media_keys: [],
  metadata: {},
};

const DEBOUNCE_MS = 2000;

/**
 * Auto-save draft hook.
 * - Loads existing draft on mount
 * - Debounced auto-save (2s) after changes
 * - Flushes unsaved changes on unmount
 * - clearDraft removes the draft from server and resets state
 */
export function useDraft(draftType: DraftType) {
  const [draft, setDraft] = useState<DraftData>(EMPTY_DRAFT);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const dirtyRef = useRef(false);
  const draftRef = useRef<DraftData>(EMPTY_DRAFT);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Keep draftRef in sync with state
  draftRef.current = draft;

  /**
   * Save current draft to server
   */
  const saveDraft = useCallback(async (data: DraftData) => {
    if (!mountedRef.current) return;
    setSaving(true);
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          draft_type: draftType,
          body: data.body || null,
          media_keys: data.media_keys.length > 0 ? data.media_keys : null,
          metadata: Object.keys(data.metadata).length > 0 ? data.metadata : null,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (mountedRef.current) {
          setDraftId(json.draft.id);
          setLastSaved(new Date());
          dirtyRef.current = false;
        }
      }
    } catch (err) {
      console.error('[useDraft] save error:', err);
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [draftType]);

  /**
   * Schedule a debounced save
   */
  const scheduleSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      saveDraft(draftRef.current);
    }, DEBOUNCE_MS);
  }, [saveDraft]);

  /**
   * Update draft state and trigger debounced save
   */
  const updateDraft = useCallback((updates: Partial<DraftData>) => {
    setDraft((prev) => {
      const next = {
        ...prev,
        ...updates,
        metadata: updates.metadata
          ? { ...prev.metadata, ...updates.metadata }
          : prev.metadata,
      };
      draftRef.current = next;
      return next;
    });
    dirtyRef.current = true;
    scheduleSave();
  }, [scheduleSave]);

  /**
   * Clear the draft from server and reset local state
   */
  const clearDraft = useCallback(async () => {
    // Cancel pending save
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (draftId) {
      try {
        await fetch(`/api/drafts/${draftId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      } catch (err) {
        console.error('[useDraft] delete error:', err);
      }
    }

    setDraft(EMPTY_DRAFT);
    draftRef.current = EMPTY_DRAFT;
    setDraftId(null);
    setLastSaved(null);
    dirtyRef.current = false;
  }, [draftId]);

  /**
   * Get current draft data (for use when submitting the post)
   */
  const getDraftData = useCallback((): DraftData => {
    return draftRef.current;
  }, []);

  /**
   * Load existing draft on mount
   */
  useEffect(() => {
    mountedRef.current = true;

    async function loadDraft() {
      try {
        const res = await fetch('/api/drafts', { credentials: 'include' });
        if (!res.ok) return;

        const json = await res.json();
        const existing: DraftRecord | undefined = json.drafts?.find(
          (d: DraftRecord) => d.draft_type === draftType
        );

        if (existing && mountedRef.current) {
          const loaded: DraftData = {
            body: existing.body || '',
            media_keys: (existing.media_keys as string[]) || [],
            metadata: (existing.metadata as DraftData['metadata']) || {},
          };
          setDraft(loaded);
          draftRef.current = loaded;
          setDraftId(existing.id);
        }
      } catch (err) {
        console.error('[useDraft] load error:', err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    loadDraft();

    // Flush on unmount
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // If there are unsaved changes, save immediately
      if (dirtyRef.current) {
        // Fire-and-forget save on unmount
        fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            draft_type: draftType,
            body: draftRef.current.body || null,
            media_keys: draftRef.current.media_keys.length > 0 ? draftRef.current.media_keys : null,
            metadata: Object.keys(draftRef.current.metadata).length > 0 ? draftRef.current.metadata : null,
          }),
        }).catch(() => {});
      }
    };
  }, [draftType]);

  return {
    draft,
    loading,
    saving,
    lastSaved,
    updateDraft,
    clearDraft,
    getDraftData,
  };
}
