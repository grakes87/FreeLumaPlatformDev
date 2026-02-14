'use client';

import { useRef, useState, useCallback } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { InitialsAvatar } from './InitialsAvatar';
import { AvatarCrop } from './AvatarCrop';

export interface AvatarUploadProps {
  /** Current avatar URL (null if no photo uploaded) */
  currentAvatarUrl: string | null;
  /** Hex color for the initials avatar fallback */
  avatarColor: string;
  /** User's display name for initials generation */
  displayName: string;
  /** Called when avatar is successfully uploaded and confirmed */
  onAvatarChange: (url: string) => void;
  /** Avatar display size in pixels (default 96) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

/**
 * Avatar upload component with crop modal.
 * Shows current avatar (photo or initials), with "Change Photo" camera overlay.
 * On file select: opens crop modal -> uploads to B2 via presigned URL -> confirms with API.
 */
export function AvatarUpload({
  currentAvatarUrl,
  avatarColor,
  displayName,
  onAvatarChange,
  size = 96,
  className,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const toast = useToast();

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Use data URL — self-contained and avoids blob URL lifecycle issues
      const reader = new FileReader();
      reader.onload = () => {
        setCropImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Reset file input so the same file can be selected again
      e.target.value = '';
    },
    []
  );

  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      setCropImage(null);
      setUploading(true);

      try {
        // Step 1: Get presigned URL from our API
        const presignRes = await fetch(
          '/api/upload/presigned?type=avatar&contentType=image/jpeg',
          { credentials: 'include' }
        );

        if (presignRes.status === 503) {
          toast.info('Photo upload is not available yet');
          setUploading(false);
          return;
        }

        if (!presignRes.ok) {
          const err = await presignRes.json();
          throw new Error(err.error || 'Failed to get upload URL');
        }

        const { uploadUrl, key, publicUrl } = await presignRes.json();

        // Step 2: Upload cropped blob directly to B2
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: croppedBlob,
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload to storage');
        }

        // Step 3: Confirm upload with our API (updates user avatar_url)
        const confirmRes = await fetch('/api/upload/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key }),
        });

        if (!confirmRes.ok) {
          const err = await confirmRes.json();
          throw new Error(err.error || 'Failed to confirm upload');
        }

        // Update local state and notify parent
        setAvatarUrl(publicUrl);
        onAvatarChange(publicUrl);
        toast.success('Photo updated');
      } catch (err) {
        console.error('[AvatarUpload] Upload failed:', err);
        toast.error(
          err instanceof Error ? err.message : 'Failed to upload photo'
        );
      } finally {
        setUploading(false);
      }
    },
    [onAvatarChange, toast]
  );

  const handleCropCancel = useCallback(() => {
    setCropImage(null);
  }, []);

  return (
    <>
      <div className={cn('relative inline-block', className)}>
        {/* Avatar display */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="rounded-full object-cover"
            style={{ width: size, height: size }}
          />
        ) : (
          <InitialsAvatar
            name={displayName}
            color={avatarColor}
            size={size}
          />
        )}

        {/* Camera overlay button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'absolute bottom-0 right-0 flex items-center justify-center rounded-full',
            'border-2 border-white bg-primary text-white shadow-sm',
            'transition-colors hover:bg-primary-dark',
            'dark:border-surface-dark',
            uploading && 'pointer-events-none opacity-60'
          )}
          style={{
            width: size * 0.33,
            height: size * 0.33,
            minWidth: 28,
            minHeight: 28,
          }}
          aria-label="Change photo"
        >
          {uploading ? (
            <Loader2
              className="animate-spin"
              style={{ width: size * 0.16, height: size * 0.16, minWidth: 14, minHeight: 14 }}
            />
          ) : (
            <Camera
              style={{ width: size * 0.16, height: size * 0.16, minWidth: 14, minHeight: 14 }}
            />
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Crop modal */}
      {cropImage && (
        <AvatarCrop
          imageSrc={cropImage}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}
