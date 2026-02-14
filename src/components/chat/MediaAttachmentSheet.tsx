'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Image, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface MediaAttachmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with uploaded media items to create the message via useChat */
  onSendMedia: (media: Array<{ media_url: string; media_type: 'image' | 'video' }>) => void;
}

interface SelectedMedia {
  file: File;
  preview: string;
}

const MAX_ATTACHMENTS = 10;

/**
 * Upload a file to /api/upload/chat-media via XHR for real progress tracking.
 * Returns { public_url }.
 */
function uploadChatMedia(
  file: File,
  onProgress: (percent: number) => void,
  signal?: { aborted: boolean }
): Promise<{ public_url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        // Cap at 95% during transfer — remaining 5% is server processing
        const percent = Math.round((e.loaded / e.total) * 95);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (signal?.aborted) return;
      onProgress(100);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          reject(new Error(data.error || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      if (!signal?.aborted) reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.open('POST', '/api/upload/chat-media');
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

/**
 * Bottom sheet for attaching media to a chat message.
 *
 * Opens the device gallery to pick photos/videos (mobile prompts take-or-choose).
 * Selected media shown as thumbnail previews with remove buttons.
 * Upload flow: POST FormData to /api/upload/chat-media with real XHR progress tracking.
 */
export function MediaAttachmentSheet({
  isOpen,
  onClose,
  onSendMedia,
}: MediaAttachmentSheetProps) {
  const [selected, setSelected] = useState<SelectedMedia[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [translateY, setTranslateY] = useState(0);

  // Upload progress: overall 0-100
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const cancelledRef = useRef(false);

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setSelected([]);
      setError(null);
      setIsSending(false);
      setTranslateY(0);
      setUploadProgress(0);
      setUploadLabel('');
      cancelledRef.current = false;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const remaining = MAX_ATTACHMENTS - selected.length;
      const newFiles = Array.from(files).slice(0, remaining);

      const newMedia: SelectedMedia[] = newFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));

      setSelected((prev) => [...prev, ...newMedia]);
      e.target.value = '';
    },
    [selected.length]
  );

  const handleRemove = useCallback((index: number) => {
    setSelected((prev) => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (isSending || selected.length === 0) return;
    setIsSending(true);
    setError(null);
    setUploadProgress(0);
    cancelledRef.current = false;

    const total = selected.length;
    const signal = { aborted: false };

    try {
      const mediaItems: Array<{ media_url: string; media_type: 'image' | 'video' }> = [];

      for (let i = 0; i < selected.length; i++) {
        if (cancelledRef.current) {
          signal.aborted = true;
          throw new Error('Upload cancelled');
        }

        const item = selected[i];
        setUploadLabel(
          total > 1
            ? `Uploading ${i + 1} of ${total}...`
            : 'Uploading...'
        );

        const result = await uploadChatMedia(
          item.file,
          (filePercent) => {
            // Overall progress: completed files + current file fraction
            const overallPercent = Math.round(
              ((i + filePercent / 100) / total) * 100
            );
            setUploadProgress(overallPercent);
          },
          signal
        );

        mediaItems.push({
          media_url: result.public_url,
          media_type: item.file.type.startsWith('video/') ? 'video' : 'image',
        });
      }

      // Clean up previews
      selected.forEach((item) => URL.revokeObjectURL(item.preview));

      // Delegate message creation to parent (goes through useChat.sendMessage)
      onSendMedia(mediaItems);
      onClose();
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to send media');
      }
      setIsSending(false);
      setUploadProgress(0);
      setUploadLabel('');
    }
  }, [isSending, selected, onSendMedia, onClose]);

  // Swipe to dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-handle]') || target.closest('[data-header]')) {
      dragStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const diff = e.touches[0].clientY - dragStartY.current;
    if (diff > 0) setTranslateY(diff);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (translateY > 100) {
      onClose();
    }
    setTranslateY(0);
    dragStartY.current = null;
  }, [translateY, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl',
          'border-t border-white/20 bg-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl',
          'transition-transform'
        )}
        style={{
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: translateY > 0 ? 'none' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Attach media"
      >
        {/* Drag handle */}
        <div data-handle className="flex justify-center pt-3 pb-1 cursor-grab">
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>

        {/* Header */}
        <div data-header className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-lg font-semibold text-white">Attach</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Gallery button */}
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={selected.length >= MAX_ATTACHMENTS || isSending}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl px-4 py-4',
              'bg-white/10 text-white transition-colors',
              'hover:bg-white/15 active:scale-[0.98]',
              'disabled:opacity-40'
            )}
            aria-label="Select from gallery"
          >
            <Image className="h-6 w-6" />
            <span className="text-sm font-medium">Choose Photo or Video</span>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Selected media previews */}
        {selected.length > 0 && (
          <div className="border-t border-white/10 px-4 pt-3 pb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-white/60">
                {selected.length}/{MAX_ATTACHMENTS} selected
              </span>
              {error && (
                <span className="text-xs text-red-400">{error}</span>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {selected.map((item, index) => (
                <div
                  key={item.preview}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl"
                >
                  {item.file.type.startsWith('video/') ? (
                    <video
                      src={item.preview}
                      className="h-full w-full object-cover"
                      preload="metadata"
                      playsInline
                      muted
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.preview}
                      alt={`Selected ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    disabled={isSending}
                    className={cn(
                      'absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full',
                      'bg-black/60 text-white transition-colors hover:bg-black/80',
                      'disabled:opacity-50'
                    )}
                    aria-label={`Remove attachment ${index + 1}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Upload progress bar */}
            {isSending && (
              <div className="mt-2 mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/70">{uploadLabel}</span>
                  <span className="text-xs font-mono tabular-nums text-white/70">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Send button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || selected.length === 0}
              className={cn(
                'mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5',
                'bg-primary text-white font-medium transition-colors',
                'hover:bg-primary/90 active:scale-[0.98]',
                'disabled:opacity-50'
              )}
            >
              {isSending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>{uploadLabel}</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send {selected.length > 1 ? `(${selected.length})` : ''}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Safe area padding for bottom */}
        <div className="pb-safe" />
      </div>
    </div>,
    document.body
  );
}
