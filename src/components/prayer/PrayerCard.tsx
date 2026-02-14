'use client';

import { useState, useCallback, useRef } from 'react';
import {
  MoreHorizontal,
  MessageCircle,
  Repeat2,
  Flag,
  Ban,
  Pencil,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AnsweredBadge } from './AnsweredBadge';
import { PostReactionBar } from '@/components/social/PostReactionBar';
import { QuickReactionPicker } from '@/components/daily/QuickReactionPicker';
import { PostCommentSheet } from '@/components/social/PostCommentSheet';
import { RepostButton } from '@/components/social/RepostButton';
import { ReportModal } from '@/components/social/ReportModal';
import { usePostReactions } from '@/hooks/usePostReactions';
import type { PrayerItem } from '@/hooks/usePrayerWall';
import VerifiedBadge from '@/components/ui/VerifiedBadge';

interface PrayerCardProps {
  prayer: PrayerItem;
  currentUserId: number;
  onPrayerUpdate?: (id: number, updates: Partial<PrayerItem>) => void;
  onDelete?: (id: number) => void;
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return `${diffWeek}w`;
}

function parseBody(body: string): React.ReactNode[] {
  // Split on @mentions and #hashtags
  const parts = body.split(/(@\w+|#\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <a
          key={i}
          href={`/profile/${part.slice(1)}`}
          className="font-medium text-primary hover:underline"
        >
          {part}
        </a>
      );
    }
    if (part.startsWith('#')) {
      return (
        <span key={i} className="font-medium text-primary">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function PrayerCard({
  prayer,
  currentUserId,
  onPrayerUpdate,
  onDelete,
}: PrayerCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [markingAnswered, setMarkingAnswered] = useState(false);
  const [testimonyInput, setTestimonyInput] = useState('');
  const [showTestimonyForm, setShowTestimonyForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { post } = prayer;
  const author = post.user;
  const isAuthor = author.id === currentUserId;
  const isAnonymous = post.is_anonymous && !isAuthor;

  // Reactions for the underlying post
  const {
    counts: reactionCounts,
    total: reactionTotal,
    userReaction,
    toggleReaction,
  } = usePostReactions(post.id);

  // Body truncation
  const lines = post.body.split('\n');
  const needsTruncation = lines.length > 5 || post.body.length > 400;
  const truncatedBody =
    needsTruncation && !expanded
      ? post.body.slice(0, 400).split('\n').slice(0, 5).join('\n')
      : post.body;

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/prayer-requests/${prayer.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        onDelete?.(prayer.id);
      }
    } catch (err) {
      console.error('[PrayerCard] delete error:', err);
    } finally {
      setDeleting(false);
      setMenuOpen(false);
    }
  }, [prayer.id, deleting, onDelete]);

  const handleMarkAnswered = useCallback(async () => {
    if (markingAnswered) return;
    setMarkingAnswered(true);
    try {
      const res = await fetch(`/api/prayer-requests/${prayer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mark_answered: true,
          testimony: testimonyInput.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onPrayerUpdate?.(prayer.id, {
          status: 'answered',
          answered_at: data.prayer?.answered_at || new Date().toISOString(),
          answered_testimony: testimonyInput.trim() || null,
        });
        setShowTestimonyForm(false);
        setTestimonyInput('');
      }
    } catch (err) {
      console.error('[PrayerCard] mark answered error:', err);
    } finally {
      setMarkingAnswered(false);
      setMenuOpen(false);
    }
  }, [prayer.id, markingAnswered, testimonyInput, onPrayerUpdate]);

  const displayName = isAnonymous ? 'Anonymous' : author.display_name;
  const avatarUrl = isAnonymous ? null : author.avatar_url;
  const avatarColor = isAnonymous ? '#9CA3AF' : author.avatar_color;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-lg dark:border-white/20 dark:bg-white/10 dark:backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: avatarColor || '#62BEBA' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div>
            <p className="flex items-center gap-1 text-sm font-semibold text-text dark:text-white">
              {displayName}
              {!isAnonymous && author.is_verified && <VerifiedBadge />}
              {isAuthor && post.is_anonymous && (
                <span className="ml-0.5 text-xs font-normal text-text-muted/60 dark:text-white/40">(you, anonymous)</span>
              )}
            </p>
            <p className="text-xs text-text-muted dark:text-white/50">
              {getRelativeTime(prayer.created_at)}
              {post.edited && <span className="ml-1 text-text-muted/50 dark:text-white/30">(edited)</span>}
            </p>
          </div>
        </div>

        {/* Context menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-lg p-1.5 text-text-muted/60 transition-colors hover:bg-black/5 hover:text-text-muted dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
            aria-label="More options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-border bg-surface py-1 shadow-lg dark:border-white/20 dark:bg-white/10 dark:backdrop-blur-2xl">
              {isAuthor && prayer.status !== 'answered' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowTestimonyForm(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-muted transition-colors hover:bg-black/5 hover:text-text dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark as Answered
                </button>
              )}
              {isAuthor && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-white/10 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              {!isAuthor && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setReportOpen(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-muted transition-colors hover:bg-black/5 hover:text-text dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <Flag className="h-4 w-4" />
                    Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-muted transition-colors hover:bg-black/5 hover:text-text dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <Ban className="h-4 w-4" />
                    Block User
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Answered badge */}
      {prayer.status === 'answered' && (
        <div className="mt-3">
          <AnsweredBadge answeredAt={prayer.answered_at} />
          {prayer.answered_testimony && (
            <p className="mt-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm italic text-green-800 dark:text-white/80">
              &ldquo;{prayer.answered_testimony}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Mark as answered form */}
      {showTestimonyForm && isAuthor && (
        <div className="mt-3 rounded-xl border border-border bg-surface-dark/5 p-3 dark:border-white/15 dark:bg-white/5">
          <p className="mb-2 text-sm font-medium text-text dark:text-white/80">Mark as Answered</p>
          <textarea
            value={testimonyInput}
            onChange={(e) => setTestimonyInput(e.target.value)}
            placeholder="Share your testimony (optional)..."
            maxLength={2000}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-white p-2 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowTestimonyForm(false);
                setTestimonyInput('');
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:text-text dark:text-white/50 dark:hover:text-white/70"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMarkAnswered}
              disabled={markingAnswered}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium text-white',
                'bg-green-600 hover:bg-green-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {markingAnswered ? 'Saving...' : 'Confirm Answered'}
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="mt-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text dark:text-white/90">
          {parseBody(truncatedBody)}
          {needsTruncation && !expanded && '...'}
        </p>
        {needsTruncation && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {/* Media (simple image display -- MediaCarousel not yet available) */}
      {post.media && post.media.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto rounded-xl">
          {post.media.map((m) => (
            <div
              key={m.id}
              className="flex-shrink-0 overflow-hidden rounded-xl"
            >
              {m.media_type === 'image' ? (
                <img
                  src={m.url}
                  alt=""
                  className="h-48 w-auto max-w-[280px] rounded-xl object-cover"
                  loading="lazy"
                />
              ) : (
                <video
                  src={m.url}
                  className="h-48 w-auto max-w-[280px] rounded-xl object-cover"
                  controls
                  preload="metadata"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          {/* Reaction bar / picker trigger — pray emoji prioritized */}
          {reactionTotal > 0 ? (
            <PostReactionBar
              counts={reactionCounts}
              total={reactionTotal}
              userReaction={userReaction}
              onOpenPicker={(e) => setPickerAnchor(e.currentTarget.getBoundingClientRect())}
              prioritizeType="pray"
            />
          ) : (
            <button
              type="button"
              onClick={(e) => setPickerAnchor(e.currentTarget.getBoundingClientRect())}
              className="rounded-full p-2 text-text-muted/60 transition-colors hover:bg-black/5 hover:text-text-muted dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
              aria-label="React"
            >
              <span className="text-base">&#x1F64F;</span>
            </button>
          )}

          {/* Comment button with count */}
          <button
            type="button"
            onClick={() => setCommentSheetOpen(true)}
            className="flex items-center gap-1 rounded-full p-2 text-text-muted/60 transition-colors hover:bg-black/5 hover:text-text-muted dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
            aria-label="Comment"
          >
            <MessageCircle className="h-5 w-5" />
            {(post.comment_count ?? 0) > 0 && (
              <span className="text-xs font-medium">{post.comment_count}</span>
            )}
          </button>
        </div>

        {/* Repost (quote to social feed) */}
        <RepostButton postId={post.id} initialReposted={post.user_reposted} isOwnPost={isAuthor} />
      </div>

      {/* Reaction picker — floating bar like daily post */}
      <QuickReactionPicker
        isOpen={pickerAnchor !== null}
        onClose={() => setPickerAnchor(null)}
        onSelect={toggleReaction}
        anchorRect={pickerAnchor}
      />

      {/* Comment bottom sheet */}
      <PostCommentSheet
        isOpen={commentSheetOpen}
        onClose={() => setCommentSheetOpen(false)}
        postId={post.id}
      />

      {/* Report modal */}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="post"
        contentId={post.id}
      />
    </div>
  );
}
