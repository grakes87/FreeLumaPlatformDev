'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { ConversationItem } from './ConversationItem';
import { MessageRequestBanner } from './MessageRequestBanner';
import { UserPicker } from './UserPicker';
import type { ConversationData, MessageRequestData } from '@/hooks/useConversations';

interface ConversationListProps {
  conversations: ConversationData[];
  messageRequests: MessageRequestData[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  currentUserId: number;
  isOnline: (userId: number) => boolean;
  onRefresh: () => void;
}

/**
 * Chat inbox: header with compose button, search bar, message request banner,
 * and scrollable list of conversations.
 */
export function ConversationList({
  conversations,
  messageRequests,
  loading,
  error,
  search,
  onSearchChange,
  currentUserId,
  isOnline,
  onRefresh,
}: ConversationListProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [localRequests, setLocalRequests] = useState<MessageRequestData[]>(messageRequests);

  // Sync external requests when they change
  useMemo(() => {
    setLocalRequests(messageRequests);
  }, [messageRequests]);

  const handleAcceptRequest = useCallback((requestId: number, _conversationId: number) => {
    setLocalRequests((prev) => prev.filter((r) => r.id !== requestId));
    onRefresh();
  }, [onRefresh]);

  const handleDeclineRequest = useCallback((requestId: number) => {
    setLocalRequests((prev) => prev.filter((r) => r.id !== requestId));
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-white/10">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Messages
        </h1>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
          aria-label="New message"
        >
          {/* Pencil/compose icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </button>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2">
        <div className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2',
          'bg-gray-100 dark:bg-white/10'
        )}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-400">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className={cn(
              'flex-1 bg-transparent text-sm text-gray-900 outline-none',
              'placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500'
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Message requests banner */}
      <MessageRequestBanner
        requests={localRequests}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
      />

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          </div>
        )}

        {error && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-2 text-sm font-medium text-blue-500 hover:text-blue-600"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16">
            {/* Empty state chat icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <p className="text-base font-medium text-gray-500 dark:text-gray-400">
              No conversations yet
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Start a chat by tapping the compose button
            </p>
          </div>
        )}

        {conversations.map((conv) => {
          // Get the other participant's ID for online check
          const otherUserId = conv.type === 'direct'
            ? conv.participants[0]?.id
            : undefined;

          return (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              currentUserId={currentUserId}
              isOnline={otherUserId ? isOnline(otherUserId) : false}
            />
          );
        })}
      </div>

      {/* User picker overlay */}
      <UserPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
      />
    </div>
  );
}
