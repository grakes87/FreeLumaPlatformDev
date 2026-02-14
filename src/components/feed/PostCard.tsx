'use client';

import { useState, useCallback } from 'react';
import type { FeedPost } from '@/hooks/useFeed';
import type { ReactionType } from '@/lib/utils/constants';
import { usePostReactions } from '@/hooks/usePostReactions';
import { useBookmark } from '@/hooks/useBookmark';
import { useImpression } from '@/hooks/useImpression';
import { PostCardInstagram } from './PostCardInstagram';
import { PostCardTikTok } from './PostCardTikTok';
import { PostComposer } from './PostComposer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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

  const { isBookmarked, toggle: toggleBookmark } = useBookmark(post.id, post.bookmarked);
  const impressionRef = useImpression(post.id);

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

  const [showEditor, setShowEditor] = useState(false);

  const handleEdit = useCallback(() => {
    setShowEditor(true);
  }, []);

  const handleEditSuccess = useCallback(
    (updatedPost: Record<string, unknown>) => {
      const updates: Partial<FeedPost> = {
        body: updatedPost.body as string,
        edited: true,
      };
      if (Array.isArray(updatedPost.media)) {
        updates.media = updatedPost.media as FeedPost['media'];
      }
      onUpdatePost?.(post.id, updates);
    },
    [post.id, onUpdatePost]
  );

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteRequest = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
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
    isBookmarked,
    reactionCounts,
    reactionTotal,
    userReaction,
    onToggleReaction: handleToggleReaction,
    onCommentCountChange: handleCommentCountChange,
    onBookmark: handleBookmark,
    onReport: handleReport,
    onBlock: handleBlock,
    onEdit: handleEdit,
    onDelete: handleDeleteRequest,
  };

  const editPostData = showEditor
    ? {
        id: post.id,
        body: post.body,
        media: post.media.map((m) => ({
          id: String(m.id),
          url: m.url,
          media_type: m.media_type as 'image' | 'video',
          thumbnail_url: m.thumbnail_url,
          width: m.width,
          height: m.height,
          duration: m.duration,
        })),
      }
    : undefined;

  return (
    <div ref={impressionRef} className="h-full">
      {feedStyle === 'tiktok' ? (
        <PostCardTikTok {...commonProps} />
      ) : (
        <PostCardInstagram {...commonProps} />
      )}
      <PostComposer
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onPostCreated={handleEditSuccess}
        onDelete={handleDeleteRequest}
        editPost={editPostData}
      />
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
