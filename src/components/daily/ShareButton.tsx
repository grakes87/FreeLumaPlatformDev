'use client';

import { useCallback, useState, type RefObject } from 'react';
import { Share2, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ShareButtonProps {
  verseText: string;
  reference: string | null;
  translationCode: string | null;
  mode: 'bible' | 'positivity';
  videoRef?: RefObject<HTMLVideoElement | null>;
  className?: string;
}

/** Wrap text into lines that fit within maxWidth on a canvas context. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export function ShareButton({
  verseText,
  reference,
  translationCode,
  mode,
  videoRef,
  className,
}: ShareButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  /** Draw gradient background onto canvas */
  const drawGradientBg = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    if (mode === 'bible') {
      grad.addColorStop(0, '#1A1A2E');
      grad.addColorStop(0.5, '#16213E');
      grad.addColorStop(1, '#0F3460');
    } else {
      grad.addColorStop(0, '#1A1A2E');
      grad.addColorStop(0.5, '#2D1B45');
      grad.addColorStop(1, '#4A1942');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }, [mode]);

  /** Draw text overlay (dark scrim, verse, reference, branding) */
  const drawTextOverlay = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number) => {
    // Dark overlay for text readability
    const overlay = ctx.createLinearGradient(0, 0, 0, H);
    overlay.addColorStop(0, 'rgba(0,0,0,0.20)');
    overlay.addColorStop(0.3, 'rgba(0,0,0,0.30)');
    overlay.addColorStop(0.7, 'rgba(0,0,0,0.30)');
    overlay.addColorStop(1, 'rgba(0,0,0,0.60)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);

    // Verse text — centered on canvas
    const fontSize = verseText.length > 200 ? 42 : verseText.length > 100 ? 50 : 58;
    ctx.font = `italic ${fontSize}px Georgia, serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;

    const maxTextWidth = W - 160;
    const quoteText = `\u201C${verseText}\u201D`;
    const lines = wrapText(ctx, quoteText, maxTextWidth);
    const lineHeight = fontSize * 1.5;
    const totalTextHeight = lines.length * lineHeight;
    const startY = H / 2 - totalTextHeight / 2;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, startY + i * lineHeight + lineHeight / 2);
    }

    // Reference below verse
    if (reference) {
      ctx.shadowBlur = 6;
      ctx.font = '30px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.80)';
      const refText = translationCode ? `${reference} (${translationCode})` : reference;
      ctx.fillText(refText, W / 2, startY + totalTextHeight + 50);
    }

    // Branding at bottom
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(W / 2 - 24, H - 130, 48, 2);
    ctx.font = '22px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.50)';
    ctx.fillText('F R E E L U M A . C O M', W / 2, H - 90);
  }, [verseText, reference, translationCode]);

  const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Try drawing video frame as background
    const video = videoRef?.current;
    if (video && video.readyState >= 2) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(W / vw, H / vh);
      const sw = vw * scale;
      const sh = vh * scale;
      ctx.drawImage(video, (W - sw) / 2, (H - sh) / 2, sw, sh);
      drawTextOverlay(ctx, W, H);

      // Attempt export — may fail with tainted canvas (cross-origin video)
      try {
        return await canvasToBlob(canvas);
      } catch {
        // Tainted canvas — clear and fall through to gradient
        ctx.clearRect(0, 0, W, H);
      }
    }

    // Gradient fallback (no video or cross-origin taint)
    drawGradientBg(ctx, W, H);
    drawTextOverlay(ctx, W, H);
    return canvasToBlob(canvas);
  }, [videoRef, drawGradientBg, drawTextOverlay]);

  const handleShare = useCallback(async () => {
    if (isGenerating) return;

    const shareText = reference
      ? `"${verseText}" - ${reference}`
      : `"${verseText}"`;

    // On mobile, prefer native share sheet (text-first, with image if supported)
    if (typeof navigator !== 'undefined' && navigator.share) {
      setIsGenerating(true);
      try {
        // Try with image first
        const blob = await generateImage();
        if (blob) {
          const file = new File([blob], 'freeluma-daily.png', { type: 'image/png' });
          const shareData = { files: [file], title: 'Free Luma Daily', text: shareText };
          if (navigator.canShare?.(shareData)) {
            await navigator.share(shareData);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            return;
          }
        }

        // Fallback: share text only via native share sheet
        await navigator.share({ title: 'Free Luma Daily', text: shareText });
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        return;
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('[ShareButton] Share error:', err);
        }
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // Fallback: copy text to clipboard (works on mobile without HTTPS)
    try {
      await navigator.clipboard.writeText(shareText);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      return;
    } catch {
      // clipboard also requires secure context — last resort: download image
    }

    // Desktop fallback: generate image and download
    setIsGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) return;
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
      console.error('[ShareButton] Download error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, generateImage, verseText, reference]);

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={isGenerating}
      className={cn(
        'flex items-center justify-center text-white transition-all',
        isGenerating ? 'cursor-wait opacity-70' : 'active:scale-90',
        className
      )}
      aria-label="Share daily post"
    >
      {showSuccess ? (
        <Check className="h-6 w-6 drop-shadow-md" />
      ) : isGenerating ? (
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        <Share2 className="h-6 w-6 drop-shadow-md" />
      )}
    </button>
  );
}
