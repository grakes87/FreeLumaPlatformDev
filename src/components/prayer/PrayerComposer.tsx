'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useDraft } from '@/hooks/useDraft';

interface PrayerComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

type PrayerPrivacy = 'public' | 'followers' | 'private';

export function PrayerComposer({ isOpen, onClose, onSubmit }: PrayerComposerProps) {
  const { draft, loading: draftLoading, saving, updateDraft, clearDraft } = useDraft('prayer_request');

  const [body, setBody] = useState('');
  const [privacy, setPrivacy] = useState<PrayerPrivacy>('public');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load draft on mount
  useEffect(() => {
    if (!draftLoading && draft.body) {
      setBody(draft.body);
      if (draft.metadata.prayer_privacy) {
        setPrivacy(draft.metadata.prayer_privacy as PrayerPrivacy);
      }
      if (draft.metadata.is_anonymous !== undefined) {
        setIsAnonymous(!!draft.metadata.is_anonymous);
      }
    }
  }, [draftLoading, draft]);

  // Auto-save on changes
  const handleBodyChange = useCallback(
    (value: string) => {
      setBody(value);
      updateDraft({ body: value });
    },
    [updateDraft]
  );

  const handlePrivacyChange = useCallback(
    (value: PrayerPrivacy) => {
      setPrivacy(value);
      updateDraft({ metadata: { prayer_privacy: value } });
    },
    [updateDraft]
  );

  const handleAnonymousChange = useCallback(
    (value: boolean) => {
      setIsAnonymous(value);
      updateDraft({ metadata: { is_anonymous: value } });
    },
    [updateDraft]
  );

  const handleSubmit = useCallback(async () => {
    if (!body.trim()) {
      setError('Please enter your prayer request');
      return;
    }
    if (body.length > 5000) {
      setError('Prayer request is too long (max 5000 characters)');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/prayer-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          body: body.trim(),
          privacy,
          is_anonymous: isAnonymous,
          media_keys: draft.media_keys.length > 0 ? draft.media_keys : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create prayer request');
      }

      // Success
      await clearDraft();
      setBody('');
      setPrivacy('public');
      setIsAnonymous(false);
      onSubmit();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prayer request');
    } finally {
      setSubmitting(false);
    }
  }, [body, privacy, isAnonymous, draft.media_keys, clearDraft, onSubmit, onClose]);

  const handleClose = useCallback(() => {
    // Draft is auto-saved, so just close
    onClose();
  }, [onClose]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const canSubmit = body.trim().length > 0 && !submitting;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg p-1.5 text-white/60 transition-colors hover:text-white"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        <h2 className="text-lg font-semibold text-white">Prayer Request</h2>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-all',
            canSubmit
              ? 'bg-primary hover:bg-primary/90'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          )}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Submit'
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {draftLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Textarea */}
            <textarea
              value={body}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder="Share your prayer request..."
              maxLength={5000}
              autoFocus
              className="min-h-[200px] w-full resize-none bg-transparent text-base leading-relaxed text-white placeholder:text-white/30 focus:outline-none"
            />

            {/* Character count */}
            <div className="flex items-center justify-between text-xs text-white/30">
              <span>
                {saving ? 'Saving draft...' : body.trim() ? 'Draft saved' : ''}
              </span>
              <span>{body.length}/5000</span>
            </div>

            {/* Media buttons (placeholder -- media upload not yet wired) */}
            <div className="flex items-center gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
                aria-label="Take photo"
              >
                <Camera className="h-4 w-4" />
                <span>Camera</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
                aria-label="Choose from gallery"
              >
                <ImageIcon className="h-4 w-4" />
                <span>Gallery</span>
              </button>
            </div>

            {/* Options */}
            <div className="space-y-4 border-t border-white/10 pt-4">
              {/* Privacy selector */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">
                  Visibility
                </label>
                <div className="flex gap-2">
                  {(['public', 'followers', 'private'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handlePrivacyChange(opt)}
                      className={cn(
                        'rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-all',
                        privacy === opt
                          ? 'bg-primary/20 text-primary ring-1 ring-primary/50'
                          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                      )}
                    >
                      {opt === 'followers' ? 'Followers Only' : opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anonymous toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/70">Post anonymously</p>
                  <p className="text-xs text-white/40">Others will see &quot;Anonymous&quot; instead of your name</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAnonymous}
                  onClick={() => handleAnonymousChange(!isAnonymous)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    isAnonymous ? 'bg-primary' : 'bg-white/20'
                  )}
                >
                  <span
                    className={cn(
                      'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      isAnonymous && 'translate-x-5'
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
