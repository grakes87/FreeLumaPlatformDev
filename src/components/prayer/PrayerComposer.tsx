'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Image as ImageIcon, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { compressMediaFile } from '@/lib/utils/compressMedia';
import { uploadWithProgress } from '@/lib/utils/uploadWithProgress';
import { generateVideoThumbnail, blobToDataUrl } from '@/lib/utils/generateVideoThumbnail';
import { useDraft } from '@/hooks/useDraft';

interface PrayerComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

type PrayerPrivacy = 'public' | 'followers';

interface MediaAttachment {
  file: File;
  previewUrl: string;
  thumbnailUrl: string | null;
  publicUrl: string | null;
  uploading: boolean;
  progress: number;
  error: string | null;
}

const MAX_MEDIA = 4;
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB (images compressed client-side before upload)
function isAllowedMediaType(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/');
}

export function PrayerComposer({ isOpen, onClose, onSubmit }: PrayerComposerProps) {
  const { draft, loading: draftLoading, saving, updateDraft, clearDraft } = useDraft('prayer_request');

  const [body, setBody] = useState('');
  const [privacy, setPrivacy] = useState<PrayerPrivacy>('public');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFileWithProgress = useCallback(
    async (file: File, previewUrl: string): Promise<string> => {
      // Compress image before upload (videos pass through as-is)
      const compressed = await compressMediaFile(file);

      const { public_url } = await uploadWithProgress(compressed, (percent) => {
        setMedia((prev) =>
          prev.map((m) =>
            m.previewUrl === previewUrl ? { ...m, progress: percent } : m
          )
        );
      });

      return public_url;
    },
    []
  );

  const handleFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const remaining = MAX_MEDIA - media.length;
      const toAdd = Array.from(files).slice(0, remaining);

      for (const file of toAdd) {
        if (!isAllowedMediaType(file.type)) {
          setError(`Unsupported file type: ${file.type}`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          setError('File too large (max 20 MB)');
          continue;
        }

        const previewUrl = URL.createObjectURL(file);
        const attachment: MediaAttachment = {
          file,
          previewUrl,
          thumbnailUrl: null,
          publicUrl: null,
          uploading: true,
          progress: 0,
          error: null,
        };

        setMedia((prev) => [...prev, attachment]);

        // Fire-and-forget thumbnail generation for videos
        if (file.type.startsWith('video/')) {
          generateVideoThumbnail(file).then((blob) => {
            if (!blob) return;
            blobToDataUrl(blob).then((dataUrl) => {
              setMedia((prev) =>
                prev.map((m) =>
                  m.previewUrl === previewUrl ? { ...m, thumbnailUrl: dataUrl } : m
                )
              );
            });
          });
        }

        try {
          const publicUrl = await uploadFileWithProgress(file, previewUrl);
          setMedia((prev) =>
            prev.map((m) =>
              m.previewUrl === previewUrl
                ? { ...m, publicUrl, uploading: false, progress: 100 }
                : m
            )
          );
        } catch (err) {
          setMedia((prev) =>
            prev.map((m) =>
              m.previewUrl === previewUrl
                ? { ...m, uploading: false, error: err instanceof Error ? err.message : 'Upload failed' }
                : m
            )
          );
        }
      }
    },
    [media.length, uploadFileWithProgress]
  );

  const removeMedia = useCallback((previewUrl: string) => {
    setMedia((prev) => {
      const item = prev.find((m) => m.previewUrl === previewUrl);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((m) => m.previewUrl !== previewUrl);
    });
  }, []);

  const reorderMedia = useCallback((fromIndex: number, toIndex: number) => {
    setMedia((prev) => {
      const items = [...prev];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return items;
    });
  }, []);

  // Drag-and-drop state for media reorder
  const [mediaDragIndex, setMediaDragIndex] = useState<number | null>(null);
  const [mediaOverIndex, setMediaOverIndex] = useState<number | null>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const mediaLongPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mediaDragStateRef = useRef({ dragIndex: -1, overIndex: -1, active: false });

  // Non-passive touch move listener for media drag
  useEffect(() => {
    const container = mediaContainerRef.current;
    if (!container || media.length <= 1) return;

    const handleTouchMove = (e: globalThis.TouchEvent) => {
      if (!mediaDragStateRef.current.active) {
        if (mediaLongPressTimer.current) clearTimeout(mediaLongPressTimer.current);
        return;
      }
      e.preventDefault();

      const touch = e.touches[0];
      const children = Array.from(container.children) as HTMLElement[];
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right) {
          if (i !== mediaDragStateRef.current.dragIndex) {
            mediaDragStateRef.current.overIndex = i;
            setMediaOverIndex(i);
          } else {
            mediaDragStateRef.current.overIndex = -1;
            setMediaOverIndex(null);
          }
          break;
        }
      }
    };

    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => container.removeEventListener('touchmove', handleTouchMove);
  }, [media.length]);

  useEffect(() => {
    return () => {
      if (mediaLongPressTimer.current) clearTimeout(mediaLongPressTimer.current);
    };
  }, []);

  const handleMediaTouchStart = useCallback((index: number) => {
    if (media.length <= 1) return;
    if (mediaLongPressTimer.current) clearTimeout(mediaLongPressTimer.current);
    mediaDragStateRef.current = { dragIndex: index, overIndex: -1, active: false };
    mediaLongPressTimer.current = setTimeout(() => {
      mediaDragStateRef.current.active = true;
      setMediaDragIndex(index);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 400);
  }, [media.length]);

  const handleMediaTouchEnd = useCallback(() => {
    if (mediaLongPressTimer.current) clearTimeout(mediaLongPressTimer.current);
    const { active, dragIndex: from, overIndex: to } = mediaDragStateRef.current;
    if (active && from !== -1 && to !== -1 && from !== to) {
      reorderMedia(from, to);
    }
    mediaDragStateRef.current = { dragIndex: -1, overIndex: -1, active: false };
    setMediaDragIndex(null);
    setMediaOverIndex(null);
  }, [reorderMedia]);

  const handleSubmit = useCallback(async () => {
    if (!body.trim()) {
      setError('Please enter your prayer request');
      return;
    }
    if (body.length > 5000) {
      setError('Prayer request is too long (max 5000 characters)');
      return;
    }

    // Check if any media is still uploading
    if (media.some((m) => m.uploading)) {
      setError('Please wait for media to finish uploading');
      return;
    }

    setError('');
    setSubmitting(true);

    // Build media array from uploaded attachments
    const uploadedMedia = media
      .filter((m) => m.publicUrl && !m.error)
      .map((m, i) => ({
        url: m.publicUrl!,
        media_type: m.file.type.startsWith('video/') ? 'video' as const : 'image' as const,
        sort_order: i,
      }));

    try {
      const res = await fetch('/api/prayer-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          body: body.trim(),
          privacy,
          is_anonymous: isAnonymous,
          media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
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
      media.forEach((m) => URL.revokeObjectURL(m.previewUrl));
      setMedia([]);
      onSubmit();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prayer request');
    } finally {
      setSubmitting(false);
    }
  }, [body, privacy, isAnonymous, media, clearDraft, onSubmit, onClose]);

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
      // iOS Safari: blur active input and force viewport reset after keyboard dismissal
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const canSubmit = body.trim().length > 0 && !submitting;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg p-1.5 text-gray-500 dark:text-white/60 transition-colors hover:text-gray-900 dark:hover:text-white"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Prayer Request</h2>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-all',
            canSubmit
              ? 'bg-primary hover:bg-primary/90'
              : 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/30 cursor-not-allowed'
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
            <Loader2 className="h-6 w-6 animate-spin text-gray-300 dark:text-white/30" />
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
              className="min-h-[200px] w-full resize-none bg-transparent text-base leading-relaxed text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none"
            />

            {/* Character count */}
            <div className="flex items-center justify-between text-xs text-gray-400 dark:text-white/30">
              <span>
                {saving ? 'Saving draft...' : body.trim() ? 'Draft saved' : ''}
              </span>
              <span>{body.length}/5000</span>
            </div>

            {/* Media previews with drag-and-drop reorder */}
            {media.length > 0 && (
              <div
                ref={mediaContainerRef}
                className="flex gap-3 overflow-x-auto pt-2 pb-1"
                onDragOver={(e) => e.preventDefault()}
              >
                {media.map((m, index) => (
                  <div
                    key={m.previewUrl}
                    draggable={media.length > 1 && !m.uploading}
                    onDragStart={() => setMediaDragIndex(index)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (mediaDragIndex !== null && index !== mediaDragIndex) setMediaOverIndex(index);
                    }}
                    onDragEnd={() => {
                      if (mediaDragIndex !== null && mediaOverIndex !== null && mediaDragIndex !== mediaOverIndex) {
                        reorderMedia(mediaDragIndex, mediaOverIndex);
                      }
                      setMediaDragIndex(null);
                      setMediaOverIndex(null);
                    }}
                    onTouchStart={() => handleMediaTouchStart(index)}
                    onTouchEnd={handleMediaTouchEnd}
                    onTouchCancel={handleMediaTouchEnd}
                    className={cn(
                      'relative flex-shrink-0 transition-all duration-150',
                      media.length > 1 && !m.uploading && 'cursor-grab',
                      mediaDragIndex === index && 'opacity-40 scale-90',
                      mediaOverIndex === index && mediaDragIndex !== null && mediaDragIndex !== index &&
                        'ring-2 ring-primary ring-offset-1 rounded-lg',
                    )}
                  >
                    {m.file.type.startsWith('video/') ? (
                      <video
                        src={m.previewUrl}
                        poster={m.thumbnailUrl || undefined}
                        preload="metadata"
                        playsInline
                        muted
                        className="h-24 w-24 rounded-lg object-cover"
                      />
                    ) : (
                      <img
                        src={m.previewUrl}
                        alt=""
                        className="h-24 w-24 rounded-lg object-cover"
                      />
                    )}
                    {m.uploading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-black/60">
                        <span className="text-xs font-semibold text-white">
                          {m.progress > 0 ? `${m.progress}%` : '...'}
                        </span>
                        <div className="mx-2 h-1.5 w-16 overflow-hidden rounded-full bg-white/20">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-200"
                            style={{ width: `${m.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {m.error && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-red-900/50">
                        <span className="text-[10px] text-red-300">Failed</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(m.previewUrl)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-200 dark:bg-gray-900 text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white"
                      aria-label="Remove"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Media button */}
            <div className="flex items-center gap-2 border-t border-gray-200 dark:border-white/10 pt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={media.length >= MAX_MEDIA}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-white/40 transition-colors hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-white/60 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Add photo or video"
              >
                <ImageIcon className="h-4 w-4" />
                <span>Photo/Video</span>
              </button>
              {media.length > 0 && (
                <span className="ml-auto text-xs text-gray-400 dark:text-white/30">{media.length}/{MAX_MEDIA}</span>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />

            {/* Options */}
            <div className="space-y-4 border-t border-gray-200 dark:border-white/10 pt-4">
              {/* Privacy selector */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-white/70">
                  Visibility
                </label>
                <div className="flex gap-2">
                  {(['public', 'followers'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handlePrivacyChange(opt)}
                      className={cn(
                        'rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-all',
                        privacy === opt
                          ? 'bg-primary/20 text-primary ring-1 ring-primary/50'
                          : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white/60'
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
                  <p className="text-sm font-medium text-gray-600 dark:text-white/70">Post anonymously</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Others will see &quot;Anonymous&quot; instead of your name</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAnonymous}
                  onClick={() => handleAnonymousChange(!isAnonymous)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    isAnonymous ? 'bg-primary' : 'bg-gray-300 dark:bg-white/20'
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
