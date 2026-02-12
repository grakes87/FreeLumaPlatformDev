'use client';

import { useRef, useCallback, useState } from 'react';
import { Share2, Download, Check } from 'lucide-react';
import { toPng } from 'html-to-image';
import { cn } from '@/lib/utils/cn';

interface ShareButtonProps {
  verseText: string;
  reference: string | null;
  translationCode: string | null;
  mode: 'bible' | 'positivity';
  className?: string;
}

export function ShareButton({
  verseText,
  reference,
  translationCode,
  mode,
  className,
}: ShareButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    if (!shareCardRef.current) return null;

    try {
      const dataUrl = await toPng(shareCardRef.current, {
        width: 1080,
        height: 1080,
        pixelRatio: 1,
        backgroundColor: '#1A1A2E',
      });

      // Convert data URL to Blob
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (err) {
      console.error('[ShareButton] Image generation error:', err);
      return null;
    }
  }, []);

  const handleShare = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const blob = await generateImage();
      if (!blob) {
        setIsGenerating(false);
        return;
      }

      // Try Web Share API first (mobile)
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        const file = new File([blob], 'freeluma-daily.png', { type: 'image/png' });
        const shareData = { files: [file] };

        if (navigator.canShare(shareData)) {
          await navigator.share({
            ...shareData,
            title: 'Free Luma Daily',
            text: reference
              ? `${verseText} - ${reference}`
              : verseText,
          });
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
          setIsGenerating(false);
          return;
        }
      }

      // Fallback: download the image
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'freeluma-daily.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      // User cancelled share dialog or other error
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[ShareButton] Share error:', err);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, generateImage, verseText, reference]);

  return (
    <>
      {/* Share button */}
      <button
        type="button"
        onClick={handleShare}
        disabled={isGenerating}
        className={cn(
          'flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-200',
          isGenerating
            ? 'cursor-wait opacity-70'
            : 'hover:bg-white/30 active:scale-95',
          className
        )}
        aria-label="Share daily post"
      >
        {showSuccess ? (
          <>
            <Check className="h-4 w-4" />
            <span>Shared</span>
          </>
        ) : isGenerating ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </>
        )}
      </button>

      {/* Hidden share card template for image generation */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: 1080,
          height: 1080,
        }}
        aria-hidden="true"
      >
        <div
          ref={shareCardRef}
          style={{
            width: 1080,
            height: 1080,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 80,
            background: mode === 'bible'
              ? 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)'
              : 'linear-gradient(135deg, #1A1A2E 0%, #2D1B45 50%, #4A1942 100%)',
            fontFamily: 'Georgia, serif',
            color: 'white',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Decorative element */}
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 40,
              height: 2,
              background: 'rgba(255,255,255,0.4)',
            }}
          />

          {/* Verse/quote text */}
          <p
            style={{
              fontSize: verseText.length > 200 ? 36 : verseText.length > 100 ? 44 : 52,
              lineHeight: 1.5,
              maxWidth: 900,
              margin: 0,
              fontStyle: 'italic',
              letterSpacing: '0.01em',
            }}
          >
            &ldquo;{verseText}&rdquo;
          </p>

          {/* Reference */}
          {reference && (
            <p
              style={{
                fontSize: 28,
                marginTop: 40,
                opacity: 0.8,
                fontStyle: 'normal',
                letterSpacing: '0.05em',
              }}
            >
              {reference}
              {translationCode ? ` (${translationCode})` : ''}
            </p>
          )}

          {/* Branding */}
          <div
            style={{
              position: 'absolute',
              bottom: 60,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 40,
                height: 2,
                background: 'rgba(255,255,255,0.3)',
              }}
            />
            <span
              style={{
                fontSize: 20,
                letterSpacing: '0.15em',
                textTransform: 'uppercase' as const,
                opacity: 0.6,
                fontFamily: 'Arial, sans-serif',
              }}
            >
              FreeLuma.com
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
