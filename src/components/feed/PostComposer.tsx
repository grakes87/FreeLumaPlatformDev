'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Image as ImageIcon,
  Loader2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { compressMediaFile } from '@/lib/utils/compressMedia';
import { uploadWithProgress } from '@/lib/utils/uploadWithProgress';
import { generateVideoThumbnail, blobToDataUrl } from '@/lib/utils/generateVideoThumbnail';
import { useAuth } from '@/hooks/useAuth';
import { useDraft, type DraftData } from '@/hooks/useDraft';

// ---- Types ----

interface MediaItem {
  id: string;
  file?: File;
  url: string;
  media_type: 'image' | 'video';
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  uploading?: boolean;
  progress?: number;
  error?: string;
}

interface PostComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (post: Record<string, unknown>) => void;
  onDelete?: () => void;
  editPost?: {
    id: number;
    body: string;
    media: MediaItem[];
  };
  defaultType?: 'post' | 'prayer_request';
}

const POST_BODY_MAX = 5000;
const CHAR_WARN_THRESHOLD = 4500;
const MAX_MEDIA = 10;
const MAX_VIDEO_DURATION_SEC = 300; // 5 minutes

// ---- Mention dropdown ----

interface MentionUser {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

function MentionDropdown({
  query,
  onSelect,
  onClose,
}: {
  query: string;
  onSelect: (username: string) => void;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 1) {
      setUsers([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=5`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [query]);

  if (!query || (users.length === 0 && !loading)) return null;

  return (
    <div className="absolute left-4 right-4 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg dark:border-border-dark dark:bg-surface-dark">
      {loading && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted dark:text-text-muted-dark">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching...
        </div>
      )}
      {users.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => onSelect(u.username)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {u.avatar_url ? (
            <img
              src={u.avatar_url}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: u.avatar_color }}
            >
              {u.display_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-text dark:text-text-dark">
              {u.display_name}
            </div>
            <div className="truncate text-xs text-text-muted dark:text-text-muted-dark">
              @{u.username}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---- Media thumbnail strip with drag-and-drop reorder ----

function MediaStrip({
  items,
  onRemove,
  onReorder,
}: {
  items: MediaItem[];
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dragStateRef = useRef({ dragIndex: -1, overIndex: -1, active: false });

  // Non-passive touch move listener for preventing scroll during drag
  useEffect(() => {
    const container = containerRef.current;
    if (!container || items.length <= 1) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current.active) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        return;
      }
      e.preventDefault();

      const touch = e.touches[0];
      const children = Array.from(container.children) as HTMLElement[];
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right) {
          if (i !== dragStateRef.current.dragIndex) {
            dragStateRef.current.overIndex = i;
            setOverIndex(i);
          } else {
            dragStateRef.current.overIndex = -1;
            setOverIndex(null);
          }
          break;
        }
      }
    };

    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => container.removeEventListener('touchmove', handleTouchMove);
  }, [items.length]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  if (items.length === 0) return null;

  const canDrag = items.length > 1;

  const handleTouchStart = (index: number) => {
    if (!canDrag) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    dragStateRef.current = { dragIndex: index, overIndex: -1, active: false };
    longPressTimer.current = setTimeout(() => {
      dragStateRef.current.active = true;
      setDragIndex(index);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 400);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    const { active, dragIndex: from, overIndex: to } = dragStateRef.current;
    if (active && from !== -1 && to !== -1 && from !== to) {
      onReorder(from, to);
    }
    dragStateRef.current = { dragIndex: -1, overIndex: -1, active: false };
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div
      ref={containerRef}
      className="flex gap-2 overflow-x-auto pt-2 pb-1"
      onDragOver={(e) => e.preventDefault()}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable={canDrag && !item.uploading}
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragIndex !== null && index !== dragIndex) setOverIndex(index);
          }}
          onDragEnd={() => {
            if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
              onReorder(dragIndex, overIndex);
            }
            setDragIndex(null);
            setOverIndex(null);
          }}
          onTouchStart={() => handleTouchStart(index)}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className={cn(
            'relative flex-shrink-0 transition-all duration-150',
            canDrag && !item.uploading && 'cursor-grab',
            dragIndex === index && 'opacity-40 scale-90',
            overIndex === index && dragIndex !== null && dragIndex !== index &&
              'ring-2 ring-primary ring-offset-1 rounded-lg',
          )}
        >
          {item.media_type === 'image' ? (
            <img
              src={item.url}
              alt="Attached"
              className="h-20 w-20 rounded-lg object-cover"
            />
          ) : (
            <div className="relative h-20 w-20 rounded-lg bg-slate-900">
              <video
                src={item.url}
                poster={item.thumbnail_url || undefined}
                preload="metadata"
                playsInline
                muted
                className="h-full w-full rounded-lg object-cover"
              />
              {item.duration != null && (
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
                  {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
                </span>
              )}
            </div>
          )}

          {/* Upload progress overlay */}
          {item.uploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-black/60">
              <span className="text-xs font-semibold text-white">
                {item.progress != null && item.progress > 0 ? `${item.progress}%` : '...'}
              </span>
              <div className="mx-2 h-1.5 w-14 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${item.progress ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Error indicator */}
          {item.error && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-red-500/30">
              <span className="text-[10px] text-white">Error</span>
            </div>
          )}

          {/* Remove button */}
          {!item.uploading && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
              aria-label="Remove media"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Avatar ----

function UserAvatar({
  user,
}: {
  user: { display_name: string; avatar_url: string | null; avatar_color: string };
}) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  const initials = user.display_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
      style={{ backgroundColor: user.avatar_color }}
    >
      {initials}
    </div>
  );
}

// ---- Main Composer ----

export function PostComposer({
  isOpen,
  onClose,
  onPostCreated,
  onDelete,
  editPost,
  defaultType = 'post',
}: PostComposerProps) {
  const { user } = useAuth();
  const isEditMode = !!editPost;
  const draftType = defaultType === 'prayer_request' ? 'prayer_request' : 'post';
  const {
    draft,
    loading: draftLoading,
    saving: draftSaving,
    updateDraft,
    clearDraft,
  } = useDraft(draftType);

  const [body, setBody] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);

  // Initialize from edit or draft
  useEffect(() => {
    if (!isOpen || initializedRef.current) return;

    if (editPost) {
      setBody(editPost.body);
      setMediaItems(editPost.media);
    } else if (!draftLoading && draft.body) {
      setBody(draft.body);
    }

    initializedRef.current = true;
  }, [isOpen, editPost, draftLoading, draft]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
    }
  }, [isOpen]);

  // Auto-grow textarea
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [body, adjustTextareaHeight]);

  // Auto-save draft on body change (not in edit mode)
  useEffect(() => {
    if (isEditMode || !isOpen || !initializedRef.current) return;
    if (body || mediaItems.length > 0) {
      updateDraft({
        body,
        media_keys: mediaItems.map((m) => m.url),
      });
    }
  }, [body, mediaItems.length, isEditMode, isOpen, updateDraft]);

  // Handle mention detection
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      if (val.length > POST_BODY_MAX) return;
      setBody(val);

      // Detect @ mention
      const cursorPos = e.target.selectionStart;
      const textBefore = val.slice(0, cursorPos);
      const atMatch = textBefore.match(/@(\w*)$/);

      if (atMatch) {
        setMentionActive(true);
        setMentionQuery(atMatch[1]);
        setMentionStartIndex(cursorPos - atMatch[0].length);
      } else {
        setMentionActive(false);
        setMentionQuery('');
      }
    },
    []
  );

  const handleMentionSelect = useCallback(
    (username: string) => {
      const before = body.slice(0, mentionStartIndex);
      const after = body.slice(
        mentionStartIndex + mentionQuery.length + 1
      );
      const newBody = `${before}@${username} ${after}`;
      setBody(newBody);
      setMentionActive(false);
      setMentionQuery('');
      textareaRef.current?.focus();
    },
    [body, mentionStartIndex, mentionQuery]
  );

  // File upload via presigned URL
  const uploadFile = useCallback(
    async (file: File, mediaType: 'image' | 'video'): Promise<MediaItem | null> => {
      const itemId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Create local preview
      const previewUrl = URL.createObjectURL(file);

      // Get video duration if video
      let duration: number | null = null;
      if (mediaType === 'video') {
        const metadataUrl = URL.createObjectURL(file);
        duration = await new Promise<number | null>((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            resolve(video.duration);
            URL.revokeObjectURL(metadataUrl);
          };
          video.onerror = () => {
            URL.revokeObjectURL(metadataUrl);
            resolve(null);
          };
          video.src = metadataUrl;
        });

        if (duration && duration > MAX_VIDEO_DURATION_SEC) {
          return {
            id: itemId,
            url: previewUrl,
            media_type: mediaType,
            duration,
            error: 'Video exceeds 5 minute limit',
          };
        }
      }

      const newItem: MediaItem = {
        id: itemId,
        file,
        url: previewUrl,
        media_type: mediaType,
        duration,
        uploading: true,
        progress: 0,
      };

      setMediaItems((prev) => [...prev, newItem]);

      // Fire-and-forget thumbnail generation for videos
      if (mediaType === 'video') {
        generateVideoThumbnail(file).then((blob) => {
          if (!blob) return;
          blobToDataUrl(blob).then((dataUrl) => {
            setMediaItems((prev) =>
              prev.map((m) =>
                m.id === itemId ? { ...m, thumbnail_url: dataUrl } : m
              )
            );
          });
        });
      }

      try {
        // Compress image before upload (videos pass through as-is)
        const compressed = await compressMediaFile(file);

        // Upload with real progress tracking
        const { public_url } = await uploadWithProgress(compressed, (percent) => {
          setMediaItems((prev) =>
            prev.map((m) => (m.id === itemId ? { ...m, progress: percent } : m))
          );
        });

        // Update item with public URL
        const completed: MediaItem = {
          id: itemId,
          url: public_url,
          media_type: mediaType,
          duration,
          uploading: false,
          progress: 100,
        };

        setMediaItems((prev) =>
          prev.map((m) => (m.id === itemId ? completed : m))
        );

        return completed;
      } catch (err) {
        setMediaItems((prev) =>
          prev.map((m) =>
            m.id === itemId
              ? { ...m, uploading: false, error: 'Upload failed' }
              : m
          )
        );
        return null;
      }
    },
    []
  );

  const handleAddMedia = useCallback(() => {
    if (mediaItems.length >= MAX_MEDIA) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;

    input.onchange = () => {
      const files = Array.from(input.files || []);
      const remaining = MAX_MEDIA - mediaItems.length;
      const filesToUpload = files.slice(0, remaining);

      filesToUpload.forEach((file) => {
        const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
        uploadFile(file, mediaType);
      });
    };

    input.click();
  }, [mediaItems.length, uploadFile]);

  const handleRemoveMedia = useCallback((id: string) => {
    setMediaItems((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const handleReorderMedia = useCallback((fromIndex: number, toIndex: number) => {
    setMediaItems((prev) => {
      const items = [...prev];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return items;
    });
  }, []);

  // Submit post
  const handleSubmit = useCallback(async () => {
    if (!body.trim() && mediaItems.length === 0) return;
    if (submitting) return;

    // Check for uploading media
    const stillUploading = mediaItems.some((m) => m.uploading);
    if (stillUploading) {
      setError('Please wait for media uploads to complete');
      return;
    }

    // Check for errored media
    const hasErrors = mediaItems.some((m) => m.error);
    if (hasErrors) {
      setError('Remove failed media items before posting');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const media = mediaItems.map((m, index) => ({
        url: m.url,
        media_type: m.media_type,
        thumbnail_url: m.thumbnail_url ?? null,
        width: m.width ?? null,
        height: m.height ?? null,
        duration: m.duration ? Math.floor(m.duration) : null,
        sort_order: index,
      }));

      const payload: Record<string, unknown> = {
        body: body.trim(),
        media,
      };

      if (defaultType === 'prayer_request') {
        payload.post_type = 'prayer_request';
      }

      let res: Response;
      if (isEditMode && editPost) {
        res = await fetch(`/api/posts/${editPost.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ body: body.trim(), media }),
        });
      } else {
        res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create post');
      }

      const newPost = await res.json();

      // Clear draft on success
      if (!isEditMode) {
        await clearDraft();
      }

      // Reset state
      setBody('');
      setMediaItems([]);

      onPostCreated?.(newPost);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }, [
    body,
    mediaItems,
    submitting,
    isEditMode,
    editPost,
    defaultType,
    clearDraft,
    onPostCreated,
    onClose,
  ]);

  // Save draft on close (not submit)
  const handleClose = useCallback(() => {
    if (!isEditMode && (body.trim() || mediaItems.length > 0)) {
      updateDraft({
        body,
        media_keys: mediaItems.filter((m) => !m.error).map((m) => m.url),
      });
    }
    setBody('');
    setMediaItems([]);
    setError(null);
    setMentionActive(false);
    onClose();
  }, [isEditMode, body, mediaItems, updateDraft, onClose]);

  if (!isOpen || !user) return null;
  if (typeof document === 'undefined') return null;

  const charCount = body.length;
  const canSubmit =
    (body.trim().length > 0 || mediaItems.length > 0) &&
    !submitting &&
    !mediaItems.some((m) => m.uploading);

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-surface dark:bg-surface-dark',
        'animate-in slide-in-from-bottom duration-300'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg p-1 text-text-muted transition-colors hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800"
          aria-label="Close composer"
        >
          <X className="h-6 w-6" />
        </button>

        <h1 className="text-lg font-semibold text-text dark:text-text-dark">
          {isEditMode
            ? 'Edit Post'
            : defaultType === 'prayer_request'
              ? 'Prayer Request'
              : 'New Post'}
        </h1>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'rounded-full px-5 py-1.5 text-sm font-semibold transition-colors',
            canSubmit
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-primary/30 text-white/50 cursor-not-allowed'
          )}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEditMode ? (
            'Save'
          ) : (
            'Post'
          )}
        </button>
      </div>

      {/* Draft saving indicator */}
      {draftSaving && !isEditMode && (
        <div className="flex items-center gap-1 px-4 py-1 text-xs text-text-muted dark:text-text-muted-dark">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving draft...
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Composer body */}
      <div className="flex-1 overflow-y-auto">
        {/* User info */}
        <div className="flex items-center gap-3 px-4 pt-4">
          <UserAvatar user={user} />
          <div className="font-medium text-text dark:text-text-dark">
            {user.display_name}
          </div>
        </div>

        {/* Media buttons + preview strip */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddMedia}
              disabled={mediaItems.length >= MAX_MEDIA}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
                mediaItems.length >= MAX_MEDIA
                  ? 'text-text-muted/30 dark:text-text-muted-dark/30 cursor-not-allowed'
                  : 'text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800'
              )}
              aria-label="Add media"
            >
              <ImageIcon className="h-5 w-5" />
              Media
            </button>

            {mediaItems.length > 0 && (
              <span className="ml-auto text-xs text-text-muted dark:text-text-muted-dark">
                {mediaItems.length}/{MAX_MEDIA}
              </span>
            )}
          </div>

          {/* Media strip */}
          <MediaStrip items={mediaItems} onRemove={handleRemoveMedia} onReorder={handleReorderMedia} />
        </div>

        {/* Textarea */}
        <div className="relative px-4 pt-3">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleTextChange}
            placeholder={
              defaultType === 'prayer_request'
                ? 'Share your prayer request...'
                : "What's on your mind?"
            }
            maxLength={POST_BODY_MAX}
            className={cn(
              'w-full resize-none bg-transparent text-lg leading-relaxed outline-none',
              'text-text dark:text-text-dark',
              'placeholder:text-text-muted/50 dark:placeholder:text-text-muted-dark/50',
              'min-h-[120px]'
            )}
            autoFocus
          />

          {/* Character count */}
          {charCount > CHAR_WARN_THRESHOLD && (
            <div
              className={cn(
                'mt-1 text-right text-xs',
                charCount >= POST_BODY_MAX
                  ? 'text-red-500'
                  : 'text-text-muted dark:text-text-muted-dark'
              )}
            >
              {charCount}/{POST_BODY_MAX}
            </div>
          )}

          {/* Mention dropdown */}
          {mentionActive && (
            <MentionDropdown
              query={mentionQuery}
              onSelect={handleMentionSelect}
              onClose={() => setMentionActive(false)}
            />
          )}
        </div>
      </div>

      {/* Delete button (edit mode only) */}
      {isEditMode && onDelete && (
        <div className="border-t border-border px-4 py-3 dark:border-border-dark">
          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <Trash2 className="h-4 w-4" />
            Delete Post
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
