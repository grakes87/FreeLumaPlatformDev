'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import type { MessageRequestData } from '@/hooks/useConversations';

interface MessageRequestBannerProps {
  requests: MessageRequestData[];
  onAccept: (requestId: number, conversationId: number) => void;
  onDecline: (requestId: number) => void;
}

/**
 * Banner showing pending message requests at the top of the conversation list.
 * Expandable to show individual requests with Accept/Decline buttons.
 */
export function MessageRequestBanner({
  requests,
  onAccept,
  onDecline,
}: MessageRequestBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [processing, setProcessing] = useState<Set<number>>(new Set());

  const handleAccept = useCallback(async (requestId: number, conversationId: number) => {
    setProcessing((prev) => new Set(prev).add(requestId));
    try {
      const res = await fetch('/api/chat/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ request_id: requestId, action: 'accept' }),
      });

      if (res.ok) {
        onAccept(requestId, conversationId);
      }
    } catch (err) {
      console.error('[MessageRequestBanner] accept error:', err);
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  }, [onAccept]);

  const handleDecline = useCallback(async (requestId: number) => {
    setProcessing((prev) => new Set(prev).add(requestId));
    try {
      const res = await fetch('/api/chat/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ request_id: requestId, action: 'decline' }),
      });

      if (res.ok) {
        onDecline(requestId);
      }
    } catch (err) {
      console.error('[MessageRequestBanner] decline error:', err);
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  }, [onDecline]);

  if (requests.length === 0) return null;

  return (
    <div className="border-b border-gray-200 dark:border-white/10">
      {/* Banner header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3',
          'hover:bg-gray-50 dark:hover:bg-white/5 transition-colors'
        )}
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          Message Requests ({requests.length})
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cn(
            'h-5 w-5 text-gray-400 transition-transform',
            expanded && 'rotate-180'
          )}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Expanded request list */}
      {expanded && (
        <div className="space-y-1 pb-2">
          {requests.map((request) => {
            const isProcessing = processing.has(request.id);
            const requester = request.requester;

            return (
              <div
                key={request.id}
                className="flex items-start gap-3 px-4 py-2"
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {requester.avatar_url ? (
                    <img
                      src={requester.avatar_url}
                      alt={requester.display_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar
                      name={requester.display_name}
                      color={requester.avatar_color}
                      size={40}
                    />
                  )}
                </div>

                {/* Info + actions */}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {requester.display_name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    @{requester.username}
                  </div>
                  {request.preview && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                      {request.preview}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAccept(request.id, request.conversation_id)}
                      className={cn(
                        'rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
                        'bg-blue-500 text-white hover:bg-blue-600',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleDecline(request.id)}
                      className={cn(
                        'rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
                        'bg-gray-200 text-gray-700 hover:bg-gray-300',
                        'dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
