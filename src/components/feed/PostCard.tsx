'use client';

import { useCallback } from 'react';
import type { FeedPost } from '@/hooks/useFeed';
import type { ReactionType } from '@/lib/utils/constants';
import { usePostReactions } from '@/hooks/usePostReactions';
import { useBookmark } from '@/hooks/useBookmark';
import { PostCardInstagram } from './PostCardInstagram';
import { PostCardTikTok } from './PostCardTikTok';

interface PostCardProps {
  post: FeedPost;
  feedStyle: 'tiktok' | 'instagram';
  currentUserId: number | null;
  onRemovePost?: (postId: number) => void;
  onUpdatePost?: (postId: number, updates: Partial<FeedPost>) => void;
}

/**
 * Unified PostCard that delegates to Instagram or TikTok variant.
 * Manages common state: reactions, bookmark toggle.
 */
export function PostCard({
  post,
  feedStyle,
  currentUserId,
  onRemovePost,
  onUpdatePost,
}: PostCardProps) {
  // Use initial values from the feed API response
  const {
    counts: reactionCounts,
    total: reactionTotal,
    userReaction,
    toggleReaction,
  } = usePostReactions(post.id);

  const { toggle: toggleBookmark } = useBookmark(post.id, post.bookmarked);

  const handleToggleReaction = useCallback(
    (type: ReactionType) => {
      toggleReaction(type);
    },
    [toggleReaction]
  );

  const handleBookmark = useCallback(() => {
    toggleBookmark();
  }, [toggleBookmark]);

  const handleReport = useCallback(() => {
    // Report is handled via PostContextMenu -> ReportModal in the variant
    // This is a placeholder -- actual report modal is opened by context menu
  }, []);

  const handleBlock = useCallback(async () => {
    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: post.user_id }),
      });
      if (res.ok) {
        onRemovePost?.(post.id);
      }
    } catch {
      console.error('[PostCard] block error');
    }
  }, [post.id, post.user_id, onRemovePost]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this post?')) return;
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        onRemovePost?.(post.id);
      }
    } catch {
      console.error('[PostCard] delete error');
    }
  }, [post.id, onRemovePost]);

  const handleCommentCountChange = useCallback(
    (delta: number) => {
      onUpdatePost?.(post.id, {
        comment_count: post.comment_count + delta,
      });
    },
    [post.id, post.comment_count, onUpdatePost]
  );

  const commonProps = {
    post,
    currentUserId,
    reactionCounts,
    reactionTotal,
    userReaction,
    onToggleReaction: handleToggleReaction,
    onCommentCountChange: handleCommentCountChange,
    onBookmark: handleBookmark,
    onReport: handleReport,
    onBlock: handleBlock,
    onDelete: handleDelete,
  };

  if (feedStyle === 'tiktok') {
    return <PostCardTikTok {...commonProps} />;
  }

  return <PostCardInstagram {...commonProps} />;
}
