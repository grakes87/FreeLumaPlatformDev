'use client';

import { useState } from 'react';
import type {
  StagedComment,
  StagedReaction,
  ContentItem,
  EngagementTargetType,
  ReactionType,
} from '@/lib/ai-engagement/types';

interface StagedItemsReviewProps {
  type: EngagementTargetType;
  items: ContentItem[];
  comments: StagedComment[];
  reactions: StagedReaction[];
  onRemoveComment: (index: number) => void;
  onPublish: () => void;
  publishing: boolean;
}

const REACTION_EMOJI: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  pray: '🙏',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function StagedItemsReview({
  type,
  items,
  comments,
  reactions,
  onRemoveComment,
  onPublish,
  publishing,
}: StagedItemsReviewProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  // Group comments and reactions by content_id
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const commentsByItem = new Map<number, { comment: StagedComment; globalIndex: number }[]>();
  comments.forEach((c, idx) => {
    const list = commentsByItem.get(c.content_id) || [];
    list.push({ comment: c, globalIndex: idx });
    commentsByItem.set(c.content_id, list);
  });

  const reactionsByItem = new Map<number, Map<ReactionType, number>>();
  reactions.forEach((r) => {
    const counts = reactionsByItem.get(r.content_id) || new Map();
    counts.set(r.reaction_type, (counts.get(r.reaction_type) || 0) + 1);
    reactionsByItem.set(r.content_id, counts);
  });

  // Get unique content IDs preserving order
  const contentIds = [...new Set([
    ...comments.map((c) => c.content_id),
    ...reactions.map((r) => r.content_id),
  ])];

  if (contentIds.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center dark:border-border-dark dark:bg-surface-dark">
        <p className="text-text-muted dark:text-text-muted-dark">
          No generated content to review. Go back and generate some.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <div className="text-sm text-text-muted dark:text-text-muted-dark">
          <strong className="text-text dark:text-text-dark">{comments.length}</strong> comments
          {' · '}
          <strong className="text-text dark:text-text-dark">{reactions.length}</strong> reactions
          {' across '}
          <strong className="text-text dark:text-text-dark">{contentIds.length}</strong> items
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={publishing || (comments.length === 0 && reactions.length === 0)}
          className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {publishing ? 'Publishing...' : 'Publish to Database'}
        </button>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl dark:bg-surface-dark">
            <h3 className="text-lg font-bold text-text dark:text-text-dark">Confirm Publish</h3>
            <p className="mt-2 text-sm text-text-muted dark:text-text-muted-dark">
              This will insert <strong>{comments.length}</strong> comments and <strong>{reactions.length}</strong> reactions
              into the database. This action cannot be easily undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-hover dark:border-border-dark dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); onPublish(); }}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                Yes, Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items */}
      {contentIds.map((contentId) => {
        const item = itemMap.get(contentId);
        const itemComments = commentsByItem.get(contentId) || [];
        const itemReactions = reactionsByItem.get(contentId);

        return (
          <div
            key={contentId}
            className="rounded-xl border border-border dark:border-border-dark"
          >
            {/* Item header */}
            <div className="border-b border-border bg-surface-hover/50 px-4 py-3 dark:border-border-dark dark:bg-surface-hover-dark/50">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-text dark:text-text-dark">
                  {item?.label || `ID: ${contentId}`}
                </span>
                {item?.verse_reference && type === 'daily' && (
                  <span className="text-xs text-text-muted dark:text-text-muted-dark">
                    ({item.verse_reference})
                  </span>
                )}
              </div>
              {item && (
                <p className="mt-0.5 truncate text-xs text-text-muted dark:text-text-muted-dark">
                  {item.content_text}
                </p>
              )}
            </div>

            {/* Comments */}
            {itemComments.length > 0 && (
              <div className="divide-y divide-border dark:divide-border-dark">
                {itemComments.map(({ comment, globalIndex }) => (
                  <div
                    key={globalIndex}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    {/* Avatar */}
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: comment.user_avatar_color }}
                    >
                      {getInitials(comment.user_display_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-text dark:text-text-dark">
                        {comment.user_display_name}
                      </span>
                      <p className="text-sm text-text-muted dark:text-text-muted-dark">
                        {comment.body}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemoveComment(globalIndex)}
                      className="shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500 dark:text-text-muted-dark dark:hover:bg-red-500/10"
                      title="Remove comment"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Reaction summary */}
            {itemReactions && itemReactions.size > 0 && (
              <div className="border-t border-border px-4 py-2.5 dark:border-border-dark">
                <div className="flex flex-wrap gap-2">
                  {[...itemReactions.entries()].map(([rtype, count]) => (
                    <span
                      key={rtype}
                      className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-1 text-xs font-medium text-text-muted dark:bg-surface-hover-dark dark:text-text-muted-dark"
                    >
                      {REACTION_EMOJI[rtype]} {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
