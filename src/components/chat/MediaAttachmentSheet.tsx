'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Image, Camera, Mic, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface MediaAttachmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Conversation ID for uploading media */
  conversationId: string;
  /** Called when voice recording is requested (switches to VoiceRecorder) */
  onVoiceRecord: () => void;
  /** Called after media message is successfully sent */
  onSent?: () => void;
}

interface SelectedMedia {
  file: File;
  preview: string;
}

const MAX_ATTACHMENTS = 10;

/**
 * Bottom sheet for attaching media to a chat message.
 *
 * Options:
 * - Gallery: select images/videos from device
 * - Camera: capture photo with camera
 * - Voice: triggers voice recording mode (delegates to parent)
 *
 * Selected media shown as thumbnail previews with remove buttons.
 * Upload flow: presigned URLs from /api/upload/chat-media -> PUT to B2 -> send message.
 */
export function MediaAttachmentSheet({
  isOpen,
  onClose,
  conversationId,
  onVoiceRecord,
  onSent,
}: MediaAttachmentSheetProps) {
  const [selected, setSelected] = useState<SelectedMedia[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [translateY, setTranslateY] = useState(0);

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setSelected([]);
      setError(null);
      setIsSending(false);
      setTranslateY(0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
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
      // Reset input so same file can be re-selected
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

    try {
      const mediaItems: Array<{
        url: string;
        type: 'image' | 'video';
        mime_type: string;
      }> = [];

      // Upload each file via presigned URL
      for (const item of selected) {
        const contentType = item.file.type;

        // 1. Get presigned URL
        const presignRes = await fetch(
          `/api/upload/chat-media?contentType=${encodeURIComponent(contentType)}`
        );
        if (!presignRes.ok) {
          const data = await presignRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to get upload URL');
        }
        const { upload_url, public_url } = await presignRes.json();

        // 2. Upload file
        const uploadRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: item.file,
        });
        if (!uploadRes.ok) {
          throw new Error(`Failed to upload ${item.file.name}`);
        }

        mediaItems.push({
          url: public_url,
          type: contentType.startsWith('video/') ? 'video' : 'image',
          mime_type: contentType,
        });
      }

      // 3. Send message with all media
      const msgRes = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'media',
            media: mediaItems,
          }),
        }
      );
      if (!msgRes.ok) {
        const data = await msgRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send message');
      }

      // Clean up previews
      selected.forEach((item) => URL.revokeObjectURL(item.preview));
      onSent?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send media');
      setIsSending(false);
    }
  }, [isSending, selected, conversationId, onSent, onClose]);

  const handleVoice = useCallback(() => {
    onClose();
    onVoiceRecord();
  }, [onClose, onVoiceRecord]);

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

        {/* Action buttons */}
        <div className="flex gap-4 px-4 pb-4">
          {/* Gallery */}
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={selected.length >= MAX_ATTACHMENTS || isSending}
            className={cn(
              'flex flex-1 flex-col items-center gap-2 rounded-2xl py-4',
              'bg-white/10 text-white transition-colors',
              'hover:bg-white/15 active:scale-95',
              'disabled:opacity-40'
            )}
            aria-label="Select from gallery"
          >
            <Image className="h-6 w-6" />
            <span className="text-xs">Gallery</span>
          </button>

          {/* Camera */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={selected.length >= MAX_ATTACHMENTS || isSending}
            className={cn(
              'flex flex-1 flex-col items-center gap-2 rounded-2xl py-4',
              'bg-white/10 text-white transition-colors',
              'hover:bg-white/15 active:scale-95',
              'disabled:opacity-40'
            )}
            aria-label="Take photo"
          >
            <Camera className="h-6 w-6" />
            <span className="text-xs">Camera</span>
          </button>

          {/* Voice */}
          <button
            type="button"
            onClick={handleVoice}
            disabled={isSending}
            className={cn(
              'flex flex-1 flex-col items-center gap-2 rounded-2xl py-4',
              'bg-white/10 text-white transition-colors',
              'hover:bg-white/15 active:scale-95',
              'disabled:opacity-40'
            )}
            aria-label="Record voice message"
          >
            <Mic className="h-6 w-6" />
            <span className="text-xs">Voice</span>
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
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

            {/* Send button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || selected.length === 0}
              className={cn(
                'mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5',
                'bg-blue-500 text-white font-medium transition-colors',
                'hover:bg-blue-600 active:scale-[0.98]',
                'disabled:opacity-50'
              )}
            >
              {isSending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Uploading...</span>
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
