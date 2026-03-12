'use client';

import { useRef, useState, useCallback } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import type { DailyContentData } from '@/hooks/useDailyContent';
import { useReactions } from '@/hooks/useReactions';
import { useAutoFitText } from '@/hooks/useAutoFitText';
import { REACTION_EMOJI_MAP, DAILY_REACTION_TYPES } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';
import { ShareButton } from './ShareButton';
import { ReactionBar } from './ReactionBar';
import { ReactionPicker } from './ReactionPicker';
import { QuickReactionPicker } from './QuickReactionPicker';
import { CommentBottomSheet } from './CommentBottomSheet';
import { CommentThread } from './CommentThread';

interface DevotionalSlideProps {
  content: DailyContentData;
  isActive?: boolean;
}

export function DevotionalSlide({ content }: DevotionalSlideProps) {
  const reflectionText = content.devotional_reflection || '';

  // Auto-fit text to available space
  const devotionalTextRef = useRef<HTMLParagraphElement>(null);
  const devotionalCenterRef = useRef<HTMLDivElement>(null);
  useAutoFitText(devotionalTextRef, devotionalCenterRef, [reflectionText], 12);

  // Reactions
  const { counts, total, userReaction, commentCount, toggleReaction, refetch } =
    useReactions(content.id);

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const reactionBarRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const [commentCountDelta, setCommentCountDelta] = useState(0);
  const displayCommentCount = commentCount + commentCountDelta;

  const handleOpenPicker = useCallback(() => {
    setShowReactionPicker(true);
  }, []);

  const handleReactionSelect = useCallback(
    (type: ReactionType) => {
      toggleReaction(type);
    },
    [toggleReaction]
  );

  const handleHeartClick = useCallback(() => {
    if (reactionBarRef.current) {
      setAnchorRect(reactionBarRef.current.getBoundingClientRect());
    }
    setShowQuickPicker(true);
  }, []);

  const handleCommentCountChange = useCallback((delta: number) => {
    setCommentCountDelta((prev) => prev + delta);
  }, []);

  const handleCloseComments = useCallback(() => {
    setShowComments(false);
    refetch();
    setCommentCountDelta(0);
  }, [refetch]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #1a1a2e 100%)',
        }}
      />

      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
        }}
      />

      {/* Content overlay */}
      <div
        className="absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-between px-6"
        style={{
          height: '100svh',
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px) + 0.5rem)',
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 2.5rem)',
        }}
      >
        {/* Top spacer */}
        <div />

        {/* Center section: title + devotional reflection text */}
        <div
          ref={devotionalCenterRef}
          className="flex max-w-lg flex-col items-center text-center overflow-hidden"
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-white/60">
            Daily Devotional
          </p>
          {content.verse_reference && (
            <p className="mb-4 text-lg font-semibold text-white drop-shadow-lg sm:text-xl">
              {content.verse_reference}
            </p>
          )}
          <p
            ref={devotionalTextRef}
            className="font-sans text-lg leading-relaxed font-light text-white/90 sm:text-xl"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
          >
            {reflectionText}
          </p>
        </div>

        {/* Bottom section: Reaction, Comment, Share in one row */}
        <div ref={reactionBarRef} className="flex items-start justify-center gap-12">
          {/* Reaction column */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleHeartClick}
              className="flex items-center justify-center transition-all active:scale-90"
            >
              {userReaction ? (
                <span className="text-2xl leading-none drop-shadow-md">
                  {REACTION_EMOJI_MAP[userReaction]}
                </span>
              ) : (
                <Heart className="h-6 w-6 text-white drop-shadow-md" />
              )}
            </button>
            <ReactionBar
              counts={counts}
              total={total}
              onOpenPicker={handleOpenPicker}
            />
          </div>

          {/* Comment column */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setShowComments(true)}
              className="flex items-center justify-center text-white transition-all active:scale-95"
            >
              <MessageCircle className="h-6 w-6 drop-shadow-md" />
            </button>
            {displayCommentCount > 0 && (
              <span className="text-xs font-semibold text-white drop-shadow-md">
                {displayCommentCount}
              </span>
            )}
          </div>

          {/* Share column */}
          <div className="flex flex-col items-center gap-1">
            <ShareButton
              verseText={content.devotional_reflection!}
              reference={null}
              translationCode={null}
              mode={content.mode}
            />
          </div>
        </div>
      </div>

      {/* Portals */}
      <ReactionPicker
        isOpen={showReactionPicker}
        onClose={() => setShowReactionPicker(false)}
        counts={counts}
        userReaction={userReaction}
        onSelect={handleReactionSelect}
      />

      <QuickReactionPicker
        isOpen={showQuickPicker}
        onClose={() => setShowQuickPicker(false)}
        onSelect={handleReactionSelect}
        anchorRect={anchorRect}
        selectedReaction={userReaction}
        reactionTypes={DAILY_REACTION_TYPES}
      />

      <CommentBottomSheet
        isOpen={showComments}
        onClose={handleCloseComments}
      >
        <CommentThread
          dailyContentId={content.id}
          onCommentCountChange={handleCommentCountChange}
        />
      </CommentBottomSheet>
    </div>
  );
}
