'use client';

import { useState, useRef } from 'react';
import { Loader2, Upload, Copy, Check, Image, X } from 'lucide-react';

interface Asset {
  key: string;
  publicUrl: string;
  name: string;
}

interface OutreachAssetUploaderProps {
  onInsert?: (url: string) => void;
  onClose?: () => void;
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif,video/mp4';

export default function OutreachAssetUploader({ onInsert, onClose }: OutreachAssetUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // 1. Get presigned URL
      const presignRes = await fetch(
        `/api/upload/presigned?type=outreach-assets&contentType=${encodeURIComponent(file.type)}`,
        { credentials: 'include' }
      );
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => null);
        throw new Error(data?.error || 'Failed to get upload URL');
      }
      const { uploadUrl, key, publicUrl } = await presignRes.json();

      // 2. Upload directly to B2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload to storage failed');

      // 3. Add to list
      const asset: Asset = { key, publicUrl, name: file.name };
      setAssets((prev) => [asset, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text dark:text-text-dark">Email Assets</h3>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1 text-text-muted hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Upload button */}
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-sm text-text-muted transition-colors hover:border-primary hover:text-primary dark:border-border-dark dark:text-text-muted-dark">
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
        {uploading ? 'Uploading...' : 'Upload image or video'}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {/* Uploaded assets */}
      {assets.length > 0 && (
        <div className="space-y-2">
          {assets.map((asset) => (
            <div
              key={asset.key}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-hover p-2 dark:border-border-dark dark:bg-surface-hover-dark"
            >
              {asset.publicUrl.match(/\.(mp4|webm)$/i) ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <span className="text-xs font-bold">MP4</span>
                </div>
              ) : (
                <img src={asset.publicUrl} alt={asset.name} className="h-10 w-10 shrink-0 rounded object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text dark:text-text-dark">{asset.name}</p>
                <p className="truncate text-xs text-text-muted dark:text-text-muted-dark">{asset.publicUrl}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => copyUrl(asset.publicUrl)}
                  className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-dark dark:hover:text-text-dark"
                  title="Copy URL"
                >
                  {copied === asset.publicUrl ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                {onInsert && (
                  <button
                    onClick={() => onInsert(asset.publicUrl)}
                    className="rounded p-1.5 text-primary hover:bg-primary/10"
                    title="Insert into template"
                  >
                    <Image className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {assets.length === 0 && !uploading && (
        <p className="text-center text-xs text-text-muted dark:text-text-muted-dark">
          Upload images for your email template (logo, photos, etc.).<br />
          Copy the URL and paste it into your template HTML.
        </p>
      )}
    </div>
  );
}
