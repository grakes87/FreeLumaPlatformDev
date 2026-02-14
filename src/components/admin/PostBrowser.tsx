'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  Flag,
  Trash2,
  ChevronDown,
  AlertTriangle,
  EyeOff,
  Eye,
  Play,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Repeat2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface PostAuthor {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface PostMediaItem {
  id: number;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
}

interface OriginalPost {
  id: number;
  body: string;
  author: PostAuthor | null;
  media: PostMediaItem[];
}

interface AdminPost {
  id: number;
  body: string;
  post_type: string;
  visibility: string;
  mode: string;
  flagged: boolean;
  hidden: boolean;
  is_anonymous: boolean;
  edited: boolean;
  deleted_at: string | null;
  created_at: string;
  author: PostAuthor | null;
  media: PostMediaItem[];
  report_count: number;
  original_post: OriginalPost | null;
}

type TypeFilter = 'all' | 'text' | 'prayer_request';
type FlagFilter = 'all' | 'flagged';
type HiddenFilter = 'all' | 'visible' | 'hidden';
type DeleteFilter = 'active' | 'all';

export function PostBrowser() {
  const toast = useToast();
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [flagFilter, setFlagFilter] = useState<FlagFilter>('all');
  const [hiddenFilter, setHiddenFilter] = useState<HiddenFilter>('all');
  const [deleteFilter, setDeleteFilter] = useState<DeleteFilter>('active');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [viewerMedia, setViewerMedia] = useState<PostMediaItem[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openViewer = (media: PostMediaItem[], index: number) => {
    setViewerMedia(media);
    setViewerIndex(index);
  };

  const closeViewer = () => {
    setViewerMedia(null);
    setViewerIndex(0);
  };

  const fetchPosts = useCallback(
    async (cursorVal?: string) => {
      if (cursorVal) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({ limit: '20' });
        if (search.trim()) params.set('search', search.trim());
        if (typeFilter !== 'all') params.set('type', typeFilter);
        if (flagFilter === 'flagged') params.set('flagged', 'true');
        if (hiddenFilter === 'hidden') params.set('hidden', 'true');
        if (hiddenFilter === 'visible') params.set('hidden', 'false');
        if (deleteFilter === 'all') params.set('deleted', 'true');
        if (dateFrom) params.set('from', dateFrom);
        if (dateTo) params.set('to', dateTo);
        if (cursorVal) params.set('cursor', cursorVal);

        const res = await fetch(`/api/admin/posts?${params}`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          const newPosts = data.posts || [];

          if (cursorVal) {
            setPosts((prev) => [...prev, ...newPosts]);
          } else {
            setPosts(newPosts);
          }
          setNextCursor(data.next_cursor || null);
          setHasMore(data.has_more || false);
        }
      } catch {
        toast.error('Failed to load posts');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, typeFilter, flagFilter, hiddenFilter, deleteFilter, dateFrom, dateTo, toast]
  );

  useEffect(() => {
    const timer = setTimeout(() => fetchPosts(), 300);
    return () => clearTimeout(timer);
  }, [fetchPosts]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchPosts(nextCursor);
    }
  };

  const toggleHidden = async (post: AdminPost) => {
    setTogglingId(post.id);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hidden: !post.hidden }),
      });

      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, hidden: !post.hidden } : p
          )
        );
        toast.success(post.hidden ? 'Post unhidden' : 'Post hidden');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update post');
      }
    } catch {
      toast.error('Failed to update post');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search post content..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-text outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:focus:border-primary"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-medium text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          >
            <option value="all">All Types</option>
            <option value="text">Text Posts</option>
            <option value="prayer_request">Prayer Requests</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>

        <div className="relative">
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value as FlagFilter)}
            className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-medium text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          >
            <option value="all">All Posts</option>
            <option value="flagged">Flagged Only</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>

        <div className="relative">
          <select
            value={hiddenFilter}
            onChange={(e) => setHiddenFilter(e.target.value as HiddenFilter)}
            className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-medium text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          >
            <option value="all">All Visibility</option>
            <option value="visible">Visible Only</option>
            <option value="hidden">Hidden Only</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>

        <div className="relative">
          <select
            value={deleteFilter}
            onChange={(e) => setDeleteFilter(e.target.value as DeleteFilter)}
            className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-medium text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          >
            <option value="active">Active Only</option>
            <option value="all">Include Deleted</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>
      </div>

      {/* Date Range */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-text-muted dark:text-text-muted-dark">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />
        <label className="text-xs font-medium text-text-muted dark:text-text-muted-dark">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-primary hover:underline"
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted dark:text-text-muted-dark">
          No posts found.
        </p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className={cn(
                'rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark',
                post.deleted_at && 'opacity-60',
                post.flagged && 'border-l-4 border-l-red-400',
                post.hidden && 'border-l-4 border-l-amber-400'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Author Avatar */}
                {post.author ? (
                  post.author.avatar_url ? (
                    <img
                      src={post.author.avatar_url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar
                      name={post.author.display_name}
                      color={post.author.avatar_color}
                      size={36}
                      className="shrink-0"
                    />
                  )
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                    <span className="text-xs text-gray-500">?</span>
                  </div>
                )}

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-text dark:text-text-dark">
                      {post.is_anonymous
                        ? 'Anonymous'
                        : post.author
                        ? `@${post.author.username}`
                        : 'Unknown'}
                    </span>
                    <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
                      #{post.id}
                    </span>

                    {/* Badges */}
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        post.post_type === 'prayer_request'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      )}
                    >
                      {post.post_type === 'prayer_request' ? 'prayer' : 'text'}
                    </span>

                    {post.flagged && (
                      <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <Flag className="h-2.5 w-2.5" />
                        flagged
                      </span>
                    )}

                    {post.hidden && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <EyeOff className="h-2.5 w-2.5" />
                        hidden
                      </span>
                    )}

                    {post.deleted_at && (
                      <span className="flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        <Trash2 className="h-2.5 w-2.5" />
                        deleted
                      </span>
                    )}

                    {post.report_count > 0 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {post.report_count} report{post.report_count !== 1 ? 's' : ''}
                      </span>
                    )}

                    {post.original_post && (
                      <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Repeat2 className="h-2.5 w-2.5" />
                        repost
                      </span>
                    )}

                    {(post.media.length > 0 || (post.original_post?.media?.length ?? 0) > 0) && (
                      <span className="flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <ImageIcon className="h-2.5 w-2.5" />
                        {post.media.length + (post.original_post?.media?.length ?? 0)}
                      </span>
                    )}
                  </div>

                  {post.body ? (
                    <p className="mt-1 text-sm text-text dark:text-text-dark line-clamp-2">
                      {post.body}
                    </p>
                  ) : !post.original_post ? (
                    <p className="mt-1 text-sm italic text-text-muted dark:text-text-muted-dark">
                      (empty)
                    </p>
                  ) : null}

                  {/* Original Post (repost) */}
                  {post.original_post && (
                    <div className="mt-2 rounded-xl border border-border bg-surface-hover p-3 dark:border-border-dark dark:bg-surface-hover-dark">
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted dark:text-text-muted-dark">
                        <Repeat2 className="h-3 w-3" />
                        <span>Repost of #{post.original_post.id}</span>
                        {post.original_post.author && (
                          <span className="font-semibold text-text dark:text-text-dark">
                            @{post.original_post.author.username}
                          </span>
                        )}
                      </div>
                      {post.original_post.body && (
                        <p className="mt-1 text-sm text-text dark:text-text-dark line-clamp-2">
                          {post.original_post.body}
                        </p>
                      )}
                      {post.original_post.media?.length > 0 && (
                        <div className="mt-1.5 flex gap-2 overflow-x-auto">
                          {post.original_post.media.map((m, idx) => (
                            <button
                              key={m.id}
                              onClick={() => openViewer(post.original_post!.media, idx)}
                              className="relative shrink-0 overflow-hidden rounded-lg border border-border dark:border-border-dark hover:opacity-80 transition-opacity"
                            >
                              {m.media_type === 'image' ? (
                                <img src={m.thumbnail_url || m.url} alt="" className="h-16 w-16 object-cover" />
                              ) : (
                                <div className="relative h-16 w-16">
                                  <video
                                    src={m.url}
                                    muted
                                    preload="metadata"
                                    className="h-full w-full object-cover"
                                    onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 0.5; }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <Play className="h-4 w-4 text-white drop-shadow" />
                                  </div>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Media Preview */}
                  {post.media.length > 0 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto">
                      {post.media.map((m, idx) => (
                        <button
                          key={m.id}
                          onClick={() => openViewer(post.media, idx)}
                          className="relative shrink-0 overflow-hidden rounded-lg border border-border dark:border-border-dark hover:opacity-80 transition-opacity"
                        >
                          {m.media_type === 'image' ? (
                            <img
                              src={m.thumbnail_url || m.url}
                              alt=""
                              className="h-20 w-20 object-cover"
                            />
                          ) : (
                            <div className="relative h-20 w-20">
                              <video
                                src={m.url}
                                muted
                                preload="metadata"
                                className="h-full w-full object-cover"
                                onLoadedData={(e) => {
                                  // Seek to 0.5s to get a representative frame
                                  (e.target as HTMLVideoElement).currentTime = 0.5;
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <Play className="h-5 w-5 text-white drop-shadow" />
                              </div>
                            </div>
                          )}
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium uppercase text-white">
                            {m.media_type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-text-muted dark:text-text-muted-dark">
                    <span>{new Date(post.created_at).toLocaleString()}</span>
                    <span className="capitalize">{post.mode}</span>
                    <span className="capitalize">{post.visibility}</span>
                    {post.edited && <span>Edited</span>}
                  </div>
                </div>

                {/* Hide/Unhide Button */}
                <button
                  onClick={() => toggleHidden(post)}
                  disabled={togglingId === post.id}
                  className={cn(
                    'rounded-lg p-1.5 transition-colors',
                    post.hidden
                      ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark'
                  )}
                  title={post.hidden ? 'Unhide post' : 'Hide post'}
                >
                  {togglingId === post.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : post.hidden ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-xl bg-surface-hover px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text disabled:opacity-50 dark:bg-surface-hover-dark dark:text-text-muted-dark dark:hover:text-text-dark"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
      {/* Media Viewer Modal */}
      {viewerMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={closeViewer}
        >
          <div
            className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeViewer}
              className="absolute -top-10 right-0 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Media Counter */}
            {viewerMedia.length > 1 && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
                {viewerIndex + 1} of {viewerMedia.length}
              </div>
            )}

            {/* Previous Button */}
            {viewerMedia.length > 1 && viewerIndex > 0 && (
              <button
                onClick={() => setViewerIndex(viewerIndex - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Next Button */}
            {viewerMedia.length > 1 && viewerIndex < viewerMedia.length - 1 && (
              <button
                onClick={() => setViewerIndex(viewerIndex + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* Media Content */}
            {viewerMedia[viewerIndex].media_type === 'image' ? (
              <img
                src={viewerMedia[viewerIndex].url}
                alt=""
                className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
              />
            ) : (
              <video
                key={viewerMedia[viewerIndex].id}
                src={viewerMedia[viewerIndex].url}
                controls
                autoPlay
                className="max-h-[85vh] max-w-[85vw] rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
