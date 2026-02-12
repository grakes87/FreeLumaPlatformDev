'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface AvatarCropProps {
  /** Image source (data URL or object URL) */
  imageSrc: string;
  /** Called with the cropped image blob on save */
  onCropComplete: (croppedBlob: Blob) => void;
  /** Called when the user cancels cropping */
  onCancel: () => void;
}

/**
 * Avatar crop modal using react-easy-crop.
 * Produces a 256x256 JPEG from the user's selected crop area.
 */
export function AvatarCrop({
  imageSrc,
  onCropComplete,
  onCancel,
}: AvatarCropProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropChanged = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);

    try {
      const blob = await getCroppedImage(imageSrc, croppedAreaPixels);
      onCropComplete(blob);
    } catch (err) {
      console.error('[AvatarCrop] Failed to crop image:', err);
    } finally {
      setSaving(false);
    }
  }, [croppedAreaPixels, imageSrc, onCropComplete]);

  return (
    <Modal isOpen onClose={onCancel} title="Crop Photo" size="md">
      <div className="flex flex-col gap-4">
        {/* Crop area */}
        <div className="relative h-64 w-full overflow-hidden rounded-lg bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropChanged}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-2">
          <span className="text-xs text-text-muted dark:text-text-muted-dark">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
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
    </Modal>
  );
}

/**
 * Extract the cropped area from an image and return as a 256x256 JPEG Blob.
 * Uses the Canvas API for client-side image processing.
 */
async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas 2d context');
  }

  // Output size: 256x256
  const OUTPUT_SIZE = 256;
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  // Draw the cropped area onto the output canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob returned null'));
        }
      },
      'image/jpeg',
      0.9
    );
  });
}

/**
 * Load an image from a URL/data URL and return the HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}
