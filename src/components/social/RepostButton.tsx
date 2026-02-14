'use client';

import { useState } from 'react';
import { Repeat2 } from 'lucide-react';
import { useRepost } from '@/hooks/useRepost';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils/cn';

interface RepostButtonProps {
  postId: number;
  repostCount?: number;
  initialReposted?: boolean;
  /** Hide the repost action when viewing own post */
  isOwnPost?: boolean;
  /** 'tiktok' renders large white icon matching TikTok action stack */
  variant?: 'default' | 'tiktok';
  onRepost?: (newPost: Record<string, unknown>) => void;
}

export function RepostButton({
  postId,
  repostCount = 0,
  initialReposted = false,
  isOwnPost = false,
  variant = 'default',
  onRepost,
}: RepostButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [reposted, setReposted] = useState(initialReposted);
  const { submitting, createRepost } = useRepost();
  const toast = useToast();

  const handleSubmit = async () => {
    setError('');

    try {
      const result = await createRepost(postId, body.trim());
      if (result) {
        onRepost?.(result.post);
        setBody('');
        setIsOpen(false);
        setReposted(true);
        toast.success('Reposted successfully');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repost');
    }
  };

  // Own posts: show icon but not clickable
  if (isOwnPost) {
    return variant === 'tiktok' ? (
      <div className="flex flex-col items-center gap-0.5 opacity-30">
        <Repeat2 className="h-7 w-7 text-white drop-shadow-md" />
      </div>
    ) : (
      <div className="flex items-center gap-1 rounded-full p-2 text-text-muted/30 dark:text-text-muted-dark/30">
        <Repeat2 className="h-5 w-5" />
      </div>
    );
  }

  return (
    <>
      {reposted ? (
        variant === 'tiktok' ? (
          <div className="flex flex-col items-center gap-0.5">
            <Repeat2 className="h-7 w-7 text-green-400 drop-shadow-md" />
            <span className="text-xs font-semibold text-green-400 drop-shadow-md">Reposted</span>
          </div>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
              'bg-green-100 text-green-700',
              'dark:bg-green-900/30 dark:text-green-400'
            )}
          >
            <Repeat2 className="h-3.5 w-3.5" />
            Reposted
          </span>
        )
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Repost"
          className={cn(
            variant === 'tiktok'
              ? 'flex flex-col items-center gap-0.5 active:scale-90'
              : cn(
                  'flex items-center gap-1 rounded-full p-2 transition-colors',
                  'hover:bg-green-50 hover:text-green-600',
                  'dark:hover:bg-green-900/20 dark:hover:text-green-400',
                  'text-text-muted dark:text-text-muted-dark'
                )
          )}
        >
          <Repeat2
            className={cn(
              variant === 'tiktok'
                ? 'h-7 w-7 text-white drop-shadow-md'
                : 'h-5 w-5'
            )}
          />
          {repostCount > 0 && (
            <span
              className={cn(
                'text-xs font-medium',
                variant === 'tiktok' && 'font-semibold text-white drop-shadow-md'
              )}
            >
              {repostCount}
            </span>
          )}
        </button>
      )}

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Quote Repost" size="md">
        <div className="space-y-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add your thoughts (optional)..."
            maxLength={5000}
            rows={4}
            className={cn(
              'w-full resize-none rounded-lg border border-border p-3 text-sm',
              'bg-white text-text placeholder:text-text-muted',
              'dark:border-border-dark dark:bg-slate-900 dark:text-text-dark dark:placeholder:text-text-muted-dark',
              'focus:outline-none focus:ring-2 focus:ring-primary/50'
            )}
          />

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted dark:text-text-muted-dark">
              {body.length}/5000
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium',
                  'text-text-muted hover:bg-slate-100',
                  'dark:text-text-muted-dark dark:hover:bg-slate-800'
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium text-white',
                  'bg-primary hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {submitting ? 'Posting...' : 'Repost'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
