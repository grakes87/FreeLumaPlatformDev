'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface AvatarCropProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

/**
 * Canvas-based avatar crop modal.
 * Draws image + circular mask entirely on <canvas> — immune to CSS conflicts.
 * Supports drag to pan and slider to zoom.
 */
export function AvatarCrop({
  imageSrc,
  onCropComplete,
  onCancel,
}: AvatarCropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stateRef = useRef({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      // iOS Safari: blur active input and force viewport reset after keyboard dismissal
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    };
  }, []);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
    };
    img.onerror = () => {
      console.error('[AvatarCrop] Failed to load image');
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const { x, y, zoom: z } = stateRef.current;

    // Checkerboard background (handles both dark and light images)
    const tileSize = 10;
    for (let row = 0; row < H; row += tileSize) {
      for (let col = 0; col < W; col += tileSize) {
        ctx.fillStyle = (Math.floor(row / tileSize) + Math.floor(col / tileSize)) % 2 === 0 ? '#ccc' : '#999';
        ctx.fillRect(col, row, tileSize, tileSize);
      }
    }

    // Draw image centered + offset + zoom
    const scale = z;
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    const ix = (W - iw) / 2 + x;
    const iy = (H - ih) / 2 + y;

    ctx.drawImage(img, ix, iy, iw, ih);

    // Draw dark overlay with circular cutout
    const circleR = Math.min(W, H) * 0.42;
    const cx = W / 2;
    const cy = H / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, circleR, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fill();

    // Circle border
    ctx.beginPath();
    ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }, []);

  // On first load, fit image to cover the crop circle
  useEffect(() => {
    if (loaded) {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (canvas && img) {
        const circleD = Math.min(canvas.width, canvas.height) * 0.84;
        const fitZoom = Math.max(circleD / img.naturalWidth, circleD / img.naturalHeight);
        stateRef.current.zoom = fitZoom;
        setZoom(fitZoom);
      }
    }
  }, [loaded]);

  // Redraw when zoom or loaded state changes
  useEffect(() => {
    stateRef.current.zoom = zoom;
    draw();
  }, [zoom, loaded, draw]);

  // Scroll-to-zoom via native event listener (non-passive to allow preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const newZoom = Math.max(0.1, Math.min(5, stateRef.current.zoom + delta));
      stateRef.current.zoom = newZoom;
      setZoom(newZoom);
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  // Mouse/touch handlers for dragging
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: stateRef.current.x,
      origY: stateRef.current.y,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    stateRef.current.x = dragRef.current.origX + dx;
    stateRef.current.y = dragRef.current.origY + dy;
    draw();
  }, [draw]);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Slider zoom
  const onSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    stateRef.current.zoom = val;
    setZoom(val);
  }, []);

  // Export cropped area
  const handleSave = useCallback(async () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setSaving(true);

    try {
      const { x, y, zoom: z } = stateRef.current;
      const W = canvas.width;
      const H = canvas.height;
      const circleR = Math.min(W, H) * 0.42;
      const cx = W / 2;
      const cy = H / 2;

      const scale = z;
      const iw = img.naturalWidth * scale;
      const ih = img.naturalHeight * scale;
      const ix = (W - iw) / 2 + x;
      const iy = (H - ih) / 2 + y;

      // Circle bounding box in canvas coords → image-native coords
      const srcX = (cx - circleR - ix) / scale;
      const srcY = (cy - circleR - iy) / scale;
      const srcSize = (circleR * 2) / scale;

      const OUTPUT_SIZE = 256;
      const outCanvas = document.createElement('canvas');
      outCanvas.width = OUTPUT_SIZE;
      outCanvas.height = OUTPUT_SIZE;
      const outCtx = outCanvas.getContext('2d')!;

      outCtx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const blob = await new Promise<Blob>((resolve, reject) => {
        outCanvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
          'image/jpeg',
          0.9
        );
      });

      onCropComplete(blob);
    } catch (err) {
      console.error('[AvatarCrop] crop failed:', err);
    } finally {
      setSaving(false);
    }
  }, [onCropComplete]);

  // Compute slider range based on image size
  const img = imgRef.current;
  const minZoom = img
    ? Math.max(0.1, Math.min(300 * 0.84 / img.naturalWidth, 300 * 0.84 / img.naturalHeight))
    : 0.1;
  const maxZoom = Math.max(minZoom * 5, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-surface shadow-xl dark:bg-surface-dark">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 dark:border-border-dark">
          <h2 className="text-lg font-semibold text-text dark:text-text-dark">
            Crop Photo
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-slate-100 hover:text-text dark:text-text-muted-dark dark:hover:bg-slate-800 dark:hover:text-text-dark"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex flex-col gap-4">
            {/* Canvas crop area */}
            <div className="flex items-center justify-center overflow-hidden rounded-lg bg-black">
              <canvas
                ref={canvasRef}
                width={300}
                height={300}
                className="cursor-grab touch-none active:cursor-grabbing"
                style={{ width: 300, height: 300 }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3 px-2">
              <span className="text-xs text-text-muted dark:text-text-muted-dark">
                Zoom
              </span>
              <input
                type="range"
                min={minZoom}
                max={maxZoom}
                step={0.01}
                value={zoom}
                onChange={onSliderChange}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary dark:bg-slate-700"
                aria-label="Zoom level"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={onCancel}
                fullWidth
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                fullWidth
                loading={saving}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
