'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import type { FeedPost, FeedAuthor, FeedMedia, FeedOriginalPost } from '@/hooks/useFeed';
import type { ProfileTab } from './ProfileTabs';
import { PostCard } from '@/components/feed/PostCard';
import { FeedMuteProvider } from '@/context/FeedMuteContext';

// ---------------------------------------------------------------------------
// toFeedPost — maps profile API items → FeedPost
//
// The profile API uses Sequelize associations so field names differ from the
// feed API: `user` instead of `author`, `is_bookmarked` instead of `bookmarked`.
// Reposts come as raw repost records with nested quotePost / originalPost.
// ---------------------------------------------------------------------------

function mapAuthor(a: unknown): FeedAuthor | null {
  if (!a || typeof a !== 'object') return null;
  const obj = a as Record<string, unknown>;
  return {
    id: (obj.id as number) ?? 0,
    username: (obj.username as string) ?? '',
    display_name: (obj.display_name as string) ?? '',
    avatar_url: (obj.avatar_url as string) ?? null,
    avatar_color: (obj.avatar_color as string) ?? '#6366f1',
    is_verified: (obj.is_verified as boolean) ?? false,
  };
}

function mapMedia(arr: unknown): FeedMedia[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((m: Record<string, unknown>) => ({
    id: (m.id as number) ?? 0,
    media_type: (m.media_type as 'image' | 'video') ?? 'image',
    url: (m.url as string) ?? '',
    thumbnail_url: (m.thumbnail_url as string) ?? null,
    width: (m.width as number) ?? null,
    height: (m.height as number) ?? null,
    duration: (m.duration as number) ?? null,
    sort_order: (m.sort_order as number) ?? 0,
  }));
}

function mapOriginalPost(o: unknown): FeedOriginalPost | null {
  if (!o || typeof o !== 'object') return null;
  const obj = o as Record<string, unknown>;
  return {
    id: (obj.id as number) ?? 0,
    body: (obj.body as string) ?? '',
    deleted: (obj.deleted as boolean) ?? false,
    // Profile API nests author as "user", feed API as "author"
    author: mapAuthor(obj.author ?? obj.user),
    media: mapMedia(obj.media),
  };
}

/** Build a FeedPost from a raw post object (works with both profile & feed API shapes). */
function buildFeedPost(post: Record<string, unknown>): FeedPost {
  return {
    id: (post.id as number) ?? 0,
    user_id: (post.user_id as number) ?? 0,
    body: (post.body as string) ?? '',
    post_type: (post.post_type as 'text' | 'prayer_request') ?? 'text',
    visibility: (post.visibility as 'public' | 'followers') ?? 'public',
    mode: (post.mode as 'bible' | 'positivity') ?? 'bible',
    edited: (post.edited as boolean) ?? false,
    is_anonymous: (post.is_anonymous as boolean) ?? false,
    created_at: (post.created_at as string) ?? new Date().toISOString(),
    updated_at: (post.updated_at as string) ?? new Date().toISOString(),
    // Profile API: "user"; Feed API: "author" — try both
    author: mapAuthor(post.author ?? post.user),
    media: mapMedia(post.media),
    reaction_count: (post.reaction_count as number) ?? 0,
    comment_count: (post.comment_count as number) ?? 0,
    repost_count: (post.repost_count as number) ?? 0,
    user_reaction: (post.user_reaction as string) ?? null,
    // Profile API: "is_bookmarked"; Feed API: "bookmarked"
    bookmarked: ((post.bookmarked ?? post.is_bookmarked) as boolean) ?? false,
    user_reposted: (post.user_reposted as boolean) ?? false,
    original_post: mapOriginalPost(post.original_post),
  };
}

function toFeedPost(
  item: Record<string, unknown>,
  tab: ProfileTab,
): FeedPost | null {
  if (tab === 'saved') {
    const innerPost = (item.post as Record<string, unknown>) ?? null;
    if (!innerPost) return null;
    return buildFeedPost(innerPost);
  }

  if (tab === 'reposts') {
    const orig = item.originalPost as Record<string, unknown> | null;
    const quote = item.quotePost as Record<string, unknown> | null;

    if (quote) {
      // Check if this is a "simple boost" repost (empty quote body, no media).
      // The API always creates a quote post record, even for simple boosts.
      // In that case, show the original post directly with full interaction.
      const quoteBody = ((quote.body as string) || '').trim();
      const quoteMedia = (quote.media as unknown[]) || [];

      if (!quoteBody && quoteMedia.length === 0 && orig) {
        // Simple boost: show the original post with its counts
        return buildFeedPost(orig);
      }

      // Quote repost with actual content: quotePost is the main post, originalPost is embedded
      const fp = buildFeedPost(quote);
      fp.original_post = orig ? mapOriginalPost(orig) : null;
      fp.user_reposted = true;
      return fp;
    }

    if (orig) {
      // Simple repost: show the original post directly
      return buildFeedPost(orig);
    }

    return null;
  }

  // Posts tab: item IS the post
  return buildFeedPost(item);
}

// ---------------------------------------------------------------------------
// ProfilePostViewer
// ---------------------------------------------------------------------------

interface ProfilePostViewerProps {
  items: Array<Record<string, unknown>>;
  tab: ProfileTab;
  startIndex: number;
  currentUserId: number | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onClose: () => void;
}

export function ProfilePostViewer({
  items,
  tab,
  startIndex,
  currentUserId,
  hasMore,
  onLoadMore,
  onClose,
}: ProfilePostViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);

  // Convert items → FeedPost[]
  useEffect(() => {
    const mapped = items
      .map((item) => toFeedPost(item, tab))
      .filter((p): p is FeedPost => p !== null);
    setPosts(mapped);
  }, [items, tab]);

  // Scroll to starting index on initial mount
  useEffect(() => {
    if (didScrollRef.current || posts.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    didScrollRef.current = true;
    el.scrollTo({ top: startIndex * window.innerHeight, behavior: 'instant' as ScrollBehavior });
  }, [posts.length, startIndex]);

  // Pagination: trigger onLoadMore when near the end
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMore) return;
    const viewportH = el.clientHeight;
    const scrollBottom = el.scrollTop + viewportH;
    const threshold = el.scrollHeight - 3 * viewportH;
    if (scrollBottom >= threshold) {
      onLoadMore();
    }
  }, [hasMore, onLoadMore]);

  // Lock body scroll when viewer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      // iOS Safari: blur active input and force viewport reset after keyboard dismissal
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleRemovePost = useCallback((postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const handleUpdatePost = useCallback((postId: number, updates: Partial<FeedPost>) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...updates } : p))
    );
  }, []);

  return (
    <FeedMuteProvider>
      <div className="fixed inset-0 z-50 bg-black">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute left-3 top-3 z-[60] flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm"
          aria-label="Close viewer"
        >
          <X className="h-5 w-5 text-white" />
        </button>

        {/* Snap-scroll container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[100dvh] w-full overflow-y-auto overscroll-none snap-y snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {posts.map((post, idx) => (
            <div
              key={`${post.id}-${idx}`}
              className="h-[100dvh] w-full snap-start snap-always"
            >
              <PostCard
                post={post}
                feedStyle="tiktok"
                currentUserId={currentUserId}
                onRemovePost={handleRemovePost}
                onUpdatePost={handleUpdatePost}
              />
            </div>
          ))}
        </div>
      </div>
    </FeedMuteProvider>
  );
}
