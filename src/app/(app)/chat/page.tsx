'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { usePresence } from '@/hooks/usePresence';
import { ConversationList } from '@/components/chat/ConversationList';

/**
 * Chat inbox page at /chat.
 * Renders the conversation list with real-time presence tracking.
 */
export default function ChatPage() {
  const { user } = useAuth();
  const {
    conversations,
    messageRequests,
    loading,
    error,
    search,
    setSearch,
    refreshConversations,
  } = useConversations();

  // Collect all participant IDs for presence tracking
  const participantIds = useMemo(() => {
    const ids: number[] = [];
    for (const conv of conversations) {
      if (conv.type === 'direct') {
        for (const p of conv.participants) {
          if (!ids.includes(p.id)) ids.push(p.id);
        }
      }
    }
    return ids;
  }, [conversations]);

  const { isOnline } = usePresence(participantIds);

  if (!user) return null;

  return (
    <div className="mx-auto h-full max-w-lg">
      <ConversationList
        conversations={conversations}
        messageRequests={messageRequests}
        loading={loading}
        error={error}
        search={search}
        onSearchChange={setSearch}
        currentUserId={user.id}
        isOnline={isOnline}
        onRefresh={refreshConversations}
      />
    </div>
  );
}
