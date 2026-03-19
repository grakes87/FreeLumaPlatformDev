'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, Check, Film, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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

const PAGE_SIZE = 60;

export function BackgroundLibraryModal({ open, onClose, onSelect }: BackgroundLibraryModalProps) {
  const [items, setItems] = useState<BackgroundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchPage = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      const res = await fetch(`/api/admin/content-production/background-library?${params}`, { credentials: 'include' });
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setSelectedUrl(null);
      setSearch('');
      setSearchInput('');
      setPage(1);
      return;
    }
    fetchPage(1, '');
  }, [open, fetchPage]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      fetchPage(1, value);
    }, 400);
  };

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
              ({total})
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

        {/* Search */}
        <div className="border-b border-border px-5 py-3 dark:border-border-dark">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
            <input
              type="text"
              placeholder="Search by filename..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text',
                'placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50',
                'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark'
              )}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted dark:text-text-muted-dark">
              {search ? 'No videos match your search.' : 'No background videos in the library yet.'}
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

        {/* Pagination + Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 dark:border-border-dark">
          <div className="flex items-center gap-2">
            {totalPages > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => fetchPage(page - 1, search)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-text-muted dark:text-text-muted-dark">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => fetchPage(page + 1, search)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
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
        </div>
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
