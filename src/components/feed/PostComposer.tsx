'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Image as ImageIcon,
  Film,
  Loader2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
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
  editPost?: {
    id: number;
    body: string;
    visibility: 'public' | 'followers';
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

// ---- Media thumbnail strip ----

function MediaStrip({
  items,
  onRemove,
}: {
  items: MediaItem[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2">
      {items.map((item) => (
        <div key={item.id} className="relative flex-shrink-0">
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
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
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
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
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
      setVisibility(editPost.visibility);
      setMediaItems(editPost.media);
    } else if (!draftLoading && draft.body) {
      setBody(draft.body);
      setVisibility(draft.metadata?.visibility ?? 'public');
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

  // Auto-save draft on body/visibility change (not in edit mode)
  useEffect(() => {
    if (isEditMode || !isOpen || !initializedRef.current) return;
    if (body || mediaItems.length > 0) {
      updateDraft({
        body,
        media_keys: mediaItems.map((m) => m.url),
        metadata: { visibility },
      });
    }
  }, [body, visibility, mediaItems.length, isEditMode, isOpen, updateDraft]);

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
        duration = await new Promise<number | null>((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            resolve(video.duration);
            URL.revokeObjectURL(video.src);
          };
          video.onerror = () => resolve(null);
          video.src = previewUrl;
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

      try {
        // Get presigned URL
        const presignRes = await fetch(
          `/api/upload/post-media?contentType=${encodeURIComponent(file.type)}`,
          { credentials: 'include' }
        );

        if (!presignRes.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { upload_url, public_url } = await presignRes.json();

        // Upload to B2
        const uploadRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error('Upload failed');
        }

        // Update item with public URL
        const completed: MediaItem = {
          id: itemId,
          url: public_url,
          media_type: mediaType,
          duration,
          uploading: false,
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

  const handleAddMedia = useCallback(
    (type: 'image' | 'video') => {
      if (mediaItems.length >= MAX_MEDIA) return;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = type === 'image' ? 'image/*' : 'video/*';
      input.multiple = true;

      input.onchange = () => {
        const files = Array.from(input.files || []);
        const remaining = MAX_MEDIA - mediaItems.length;
        const filesToUpload = files.slice(0, remaining);

        filesToUpload.forEach((file) => {
          uploadFile(file, type);
        });
      };

      input.click();
    },
    [mediaItems.length, uploadFile]
  );

  const handleRemoveMedia = useCallback((id: string) => {
    setMediaItems((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
      return prev.filter((m) => m.id !== id);
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
        visibility,
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
          body: JSON.stringify({ body: body.trim(), visibility }),
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
      setVisibility('public');
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
    visibility,
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
        metadata: { visibility },
      });
    }
    setBody('');
    setMediaItems([]);
    setError(null);
    setMentionActive(false);
    onClose();
  }, [isEditMode, body, mediaItems, visibility, updateDraft, onClose]);

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
          <div>
            <div className="font-medium text-text dark:text-text-dark">
              {user.display_name}
            </div>
            {/* Visibility selector */}
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'followers')}
              className="mt-0.5 rounded border border-border bg-transparent px-1 py-0.5 text-xs text-text-muted dark:border-border-dark dark:text-text-muted-dark"
            >
              <option value="public">Public</option>
              <option value="followers">Followers Only</option>
            </select>
          </div>
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

        {/* Media strip */}
        <MediaStrip items={mediaItems} onRemove={handleRemoveMedia} />
      </div>

      {/* Bottom toolbar */}
      <div className="border-t border-border px-4 py-3 dark:border-border-dark">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAddMedia('image')}
            disabled={mediaItems.length >= MAX_MEDIA}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
              mediaItems.length >= MAX_MEDIA
                ? 'text-text-muted/30 dark:text-text-muted-dark/30 cursor-not-allowed'
                : 'text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800'
            )}
            aria-label="Add photo"
          >
            <ImageIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Photo</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddMedia('video')}
            disabled={mediaItems.length >= MAX_MEDIA}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
              mediaItems.length >= MAX_MEDIA
                ? 'text-text-muted/30 dark:text-text-muted-dark/30 cursor-not-allowed'
                : 'text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800'
            )}
            aria-label="Add video"
          >
            <Film className="h-5 w-5" />
            <span className="hidden sm:inline">Video</span>
          </button>

          {mediaItems.length > 0 && (
            <span className="ml-auto text-xs text-text-muted dark:text-text-muted-dark">
              {mediaItems.length}/{MAX_MEDIA} media
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
