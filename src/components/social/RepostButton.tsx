'use client';

import { useState } from 'react';
import { Repeat2 } from 'lucide-react';
import { useRepost } from '@/hooks/useRepost';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils/cn';

interface RepostButtonProps {
  postId: number;
  repostCount?: number;
  onRepost?: (newPost: Record<string, unknown>) => void;
}

export function RepostButton({
  postId,
  repostCount = 0,
  onRepost,
}: RepostButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const { submitting, createRepost } = useRepost();

  const handleSubmit = async () => {
    if (!body.trim()) {
      setError('Quote body is required');
      return;
    }

    setError('');

    try {
      const result = await createRepost(postId, body.trim());
      if (result) {
        onRepost?.(result.post);
        setBody('');
        setIsOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repost');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Repost"
        className={cn(
          'flex items-center gap-1 rounded-full p-2 transition-colors',
          'hover:bg-green-50 hover:text-green-600',
          'dark:hover:bg-green-900/20 dark:hover:text-green-400',
          'text-text-muted dark:text-text-muted-dark'
        )}
      >
        <Repeat2 className="h-5 w-5" />
        {repostCount > 0 && (
          <span className="text-xs font-medium">{repostCount}</span>
        )}
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Quote Repost" size="md">
        <div className="space-y-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add your thoughts..."
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
                disabled={submitting || !body.trim()}
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
