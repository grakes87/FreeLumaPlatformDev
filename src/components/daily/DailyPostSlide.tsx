'use client';

import { useMemo } from 'react';
import type { DailyContentData } from '@/hooks/useDailyContent';
import { TranslationSwitcher } from './TranslationSwitcher';
import { DateNavigator } from './DateNavigator';
import { ShareButton } from './ShareButton';

interface DailyPostSlideProps {
  content: DailyContentData;
  activeTranslation: string | null;
  availableTranslations: string[];
  onSwitchTranslation: (code: string) => void;
}

export function DailyPostSlide({
  content,
  activeTranslation,
  availableTranslations,
  onSwitchTranslation,
}: DailyPostSlideProps) {
  const hasVideo = content.video_background_url &&
    content.video_background_url !== '' &&
    !content.video_background_url.includes('placeholder');

  // Get the displayed text for the active translation
  const displayText = useMemo(() => {
    if (!activeTranslation) return content.content_text;
    const translation = content.translations.find(
      (t) => t.code === activeTranslation
    );
    return translation?.text || content.content_text;
  }, [activeTranslation, content.translations, content.content_text]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Background layer */}
      {hasVideo ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          poster=""
        >
          <source src={content.video_background_url} type="video/mp4" />
        </video>
      ) : (
        /* Gradient fallback when no video is available */
        <div
          className={
            content.mode === 'bible'
              ? 'absolute inset-0 bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460]'
              : 'absolute inset-0 bg-gradient-to-br from-[#1A1A2E] via-[#2D1B45] to-[#4A1942]'
          }
        />
      )}

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />

      {/* Content overlay */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-between px-6 pt-20 pb-24">
        {/* Top area: Translation switcher + Date navigator */}
        <div className="flex w-full flex-col items-center gap-3">
          <TranslationSwitcher
            translations={availableTranslations}
            activeTranslation={activeTranslation}
            onSwitch={onSwitchTranslation}
            mode={content.mode}
          />
          <DateNavigator currentDate={content.post_date} />
        </div>

        {/* Center: Verse/quote text */}
        <div className="flex max-w-lg flex-col items-center gap-4 text-center">
          <p
            className={
              'text-xl leading-relaxed font-light tracking-wide text-white drop-shadow-lg sm:text-2xl md:text-3xl ' +
              (content.mode === 'bible' ? 'font-serif italic' : 'font-sans')
            }
            style={{
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            &ldquo;{displayText}&rdquo;
          </p>

          {/* Reference / attribution */}
          {content.verse_reference && (
            <p className="text-sm font-medium tracking-widest text-white/70 uppercase drop-shadow-md sm:text-base">
              {content.verse_reference}
              {activeTranslation ? ` (${activeTranslation})` : ''}
            </p>
          )}
        </div>

        {/* Bottom: Share button */}
        <ShareButton
          verseText={displayText}
          reference={content.verse_reference}
          translationCode={activeTranslation}
          mode={content.mode}
        />
      </div>
    </div>
  );
}
