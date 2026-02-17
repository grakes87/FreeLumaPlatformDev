'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import { useVerseCategoryReactions } from '@/hooks/useVerseCategoryReactions';
import { REACTION_EMOJI_MAP, DAILY_REACTION_TYPES } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';
import type { VerseData } from '@/hooks/useVerseByCategoryFeed';
import { ShareButton } from './ShareButton';
import { ReactionBar } from './ReactionBar';
import { ReactionPicker } from './ReactionPicker';
import { QuickReactionPicker } from './QuickReactionPicker';
import { CommentBottomSheet } from './CommentBottomSheet';
import { VerseCategoryCommentThread } from './VerseCategoryCommentThread';

interface VerseByCategorySlideProps {
  verse: VerseData;
  backgroundUrl: string | null;
  initialUserReaction: ReactionType | null;
  initialReactionCounts: Record<string, number>;
  initialReactionTotal: number;
  initialCommentCount: number;
  activeTranslation: string | null;
}

export function VerseByCategorySlide({
  verse,
  backgroundUrl,
  initialUserReaction,
  initialReactionCounts,
  initialReactionTotal,
  initialCommentCount,
  activeTranslation,
}: VerseByCategorySlideProps) {
  // Get displayed text for the active translation
  const displayText = useMemo(() => {
    if (!activeTranslation) return verse.content_text;
    const translation = verse.translations.find(
      (t) => t.translation_code.toUpperCase() === activeTranslation.toUpperCase()
    );
    return translation?.translated_text ?? verse.content_text;
  }, [activeTranslation, verse.translations, verse.content_text]);

  // Reactions via hook with initial data from parent API response
  const { counts, total, userReaction, commentCount, toggleReaction, refetch } =
    useVerseCategoryReactions(verse.id, {
      initialUserReaction,
      initialCounts: initialReactionCounts,
      initialTotal: initialReactionTotal,
      initialCommentCount,
    });

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const reactionBarRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Local comment count delta for badge
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

  // Heart button always opens quick picker
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
      {/* Background layer -- dark base */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />

      {/* Background image */}
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      )}

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />

      {/* Content overlay */}
      <div
        className="absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-between px-6"
        style={{
          height: '100svh',
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px) + 0.5rem)',
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 2.5rem)',
        }}
      >
        {/* Top area: Category name badge (where date normally appears) */}
        <div className="flex w-full flex-col items-center gap-1">
          <p className="text-xs font-medium uppercase tracking-widest text-white/60">
            Verse by Category
          </p>
          <h2 className="text-lg font-semibold text-white drop-shadow-lg">
            {verse.category?.name ?? 'All Categories'}
          </h2>
        </div>

        {/* Center: Verse text */}
        <div className="flex max-w-lg flex-col items-center gap-4 text-center">
          <p
            className="fl-font-daily-verse text-xl leading-relaxed font-light tracking-wide text-white drop-shadow-lg font-serif italic sm:text-2xl md:text-3xl"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
          >
            &ldquo;{displayText}&rdquo;
          </p>

          {/* Reference / attribution */}
          {verse.verse_reference && (
            <p className="fl-font-daily-reference text-sm font-medium tracking-widest text-white/70 uppercase drop-shadow-md sm:text-base">
              {verse.verse_reference}
              {activeTranslation ? ` (${activeTranslation})` : ''}
            </p>
          )}
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
              verseText={displayText}
              reference={verse.verse_reference}
              translationCode={activeTranslation}
              mode="bible"
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
        <VerseCategoryCommentThread
          verseCategoryContentId={verse.id}
          onCommentCountChange={handleCommentCountChange}
        />
      </CommentBottomSheet>
    </div>
  );
}
