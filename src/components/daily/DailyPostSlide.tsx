'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import type { DailyContentData } from '@/hooks/useDailyContent';
import { useReactions } from '@/hooks/useReactions';
import { REACTION_EMOJI_MAP, DAILY_REACTION_TYPES } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';
import { DateNavigator } from './DateNavigator';
import { ShareButton } from './ShareButton';
import { ReactionBar } from './ReactionBar';
import { ReactionPicker } from './ReactionPicker';
import { QuickReactionPicker } from './QuickReactionPicker';
import { CommentBottomSheet } from './CommentBottomSheet';
import { CommentThread } from './CommentThread';

interface DailyPostSlideProps {
  content: DailyContentData;
  activeTranslation: string | null;
  isActive?: boolean;
  feedMode?: boolean;
}

export function DailyPostSlide({
  content,
  activeTranslation,
  isActive = true,
  feedMode = false,
}: DailyPostSlideProps) {
  const bgVideoRef = useRef<HTMLVideoElement>(null);

  const hasVideo = content.video_background_url &&
    content.video_background_url !== '' &&
    !content.video_background_url.includes('placeholder');

  // Pause/resume background video based on isActive
  useEffect(() => {
    const video = bgVideoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive]);

  // Track video readiness — reset when video URL changes
  const [videoReady, setVideoReady] = useState(!hasVideo);
  const prevVideoUrl = useRef(content.video_background_url);

  useEffect(() => {
    if (content.video_background_url !== prevVideoUrl.current) {
      prevVideoUrl.current = content.video_background_url;
      if (hasVideo) {
        setVideoReady(false);
      } else {
        setVideoReady(true);
      }
    }
  }, [content.video_background_url, hasVideo]);

  const handleVideoCanPlay = useCallback(() => {
    setVideoReady(true);
  }, []);

  // Get the displayed text for the active translation
  const displayText = useMemo(() => {
    if (!activeTranslation) return content.content_text;
    const translation = content.translations.find(
      (t) => t.code === activeTranslation
    );
    return translation?.text || content.content_text;
  }, [activeTranslation, content.translations, content.content_text]);

  // Reactions
  const { counts, total, userReaction, commentCount, toggleReaction, refetch } =
    useReactions(content.id);

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const reactionBarRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Local comment count for badge (synced from reactions API + deltas from thread)
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

  // Heart button — always opens quick picker
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
    // Refresh reaction data (includes updated comment_count)
    refetch();
    setCommentCountDelta(0);
  }, [refetch]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Background layer — dark base while video loads */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      {hasVideo && (
        <video
          ref={bgVideoRef}
          key={content.video_background_url}
          crossOrigin="anonymous"
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={handleVideoCanPlay}
          className={
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ' +
            (videoReady ? 'opacity-100' : 'opacity-0')
          }
        >
          <source src={content.video_background_url} type="video/mp4" />
        </video>
      )}

      {/* Loading spinner while video buffers */}
      {hasVideo && !videoReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />

      {/* Content overlay — sized to dynamic viewport so content stays visible */}
      <div
        className="absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-between px-6"
        style={{
          height: '100svh',
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px) + 0.5rem)',
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 2.5rem)',
        }}
      >
        {/* Top area: Date navigator */}
        <div className="flex w-full flex-col items-center gap-3">
          {feedMode ? (
            <FeedDateLabel date={content.post_date} mode={content.mode} />
          ) : (
            <DateNavigator currentDate={content.post_date} />
          )}
        </div>

        {/* Center: Verse/quote text */}
        <div className="flex max-w-lg flex-col items-center gap-4 text-center">
          <p
            className={
              'fl-font-daily-verse text-xl leading-relaxed font-light tracking-wide text-white drop-shadow-lg sm:text-2xl md:text-3xl ' +
              (content.mode === 'bible' ? 'font-serif italic' : 'font-sans')
            }
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
          >
            &ldquo;{displayText}&rdquo;
          </p>

          {/* Reference / attribution */}
          {content.verse_reference && (
            <p
              className="fl-font-daily-reference text-sm font-medium tracking-widest text-white/70 uppercase drop-shadow-md sm:text-base"
            >
              {content.verse_reference}
              {activeTranslation ? ` (${activeTranslation})` : ''}
            </p>
          )}
        </div>

        {/* Bottom section: Reaction, Comment, Share in one row */}
        <div ref={reactionBarRef} className="flex items-start justify-center gap-12">
          {/* Reaction column: icon then counts below */}
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

          {/* Comment column: icon then count below */}
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
              reference={content.verse_reference}
              translationCode={activeTranslation}
              mode={content.mode}
              videoRef={bgVideoRef}
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

/** Header label + date for feed mode (matches LumaShort header style) */
function FeedDateLabel({ date, mode }: { date: string; mode: string }) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = date === todayStr;

  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
  const isYesterday = date === yesterdayStr;

  const dateLabel = isToday
    ? 'Today'
    : isYesterday
      ? 'Yesterday'
      : (() => {
          const [year, month, day] = date.split('-').map(Number);
          const d = new Date(year, month - 1, day);
          return d.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
        })();

  const typeLabel = mode === 'bible' ? 'Bible Verse' : 'Daily Quote';

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs font-medium uppercase tracking-widest text-white/60">{typeLabel}</p>
      <h2 className="text-lg font-semibold text-white drop-shadow-lg">{dateLabel}</h2>
    </div>
  );
}
