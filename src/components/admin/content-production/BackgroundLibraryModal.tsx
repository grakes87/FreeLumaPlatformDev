'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, Check, Film } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';

interface BackgroundItem {
  id: number;
  url: string;
}

interface BackgroundLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export function BackgroundLibraryModal({ open, onClose, onSelect }: BackgroundLibraryModalProps) {
  const [items, setItems] = useState<BackgroundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedUrl(null);
      return;
    }
    setLoading(true);
    fetch('/api/admin/content-production/background-library', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = useCallback(async () => {
    if (!selectedUrl) return;
    setSaving(true);
    try {
      onSelect(selectedUrl);
    } finally {
      setSaving(false);
      onClose();
    }
  }, [selectedUrl, onSelect, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-surface shadow-xl dark:bg-surface-dark">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-border-dark">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-text dark:text-text-dark">
              Background Library
            </h2>
            <span className="text-sm text-text-muted dark:text-text-muted-dark">
              ({items.length})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted dark:text-text-muted-dark">
              No background videos in the library yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => (
                <VideoThumbnail
                  key={item.id}
                  url={item.url}
                  selected={selectedUrl === item.url}
                  onSelect={() => setSelectedUrl(item.url)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-3 dark:border-border-dark">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedUrl}
              loading={saving}
              onClick={handleSave}
            >
              Use Selected
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function VideoThumbnail({
  url,
  selected,
  onSelect,
}: {
  url: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => videoRef.current?.play().catch(() => {})}
      onMouseLeave={() => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
      className={cn(
        'relative aspect-video overflow-hidden rounded-lg border-2 transition-all',
        selected
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-border hover:border-primary/50 dark:border-border-dark dark:hover:border-primary/50'
      )}
    >
      <video
        ref={videoRef}
        src={url}
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
      {selected && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
          <div className="rounded-full bg-primary p-1.5">
            <Check className="h-4 w-4 text-white" />
          </div>
        </div>
      )}
    </button>
  );
}
