'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useImmersive } from '@/context/ImmersiveContext';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { ChatView } from '@/components/chat/ChatView';

interface Participant {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  is_verified: boolean;
}

interface ConversationDetail {
  id: number;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  participants: Array<{
    id: number;
    user_id: number;
    role: string;
    user: Participant;
  }>;
}

/**
 * Individual chat conversation page at /chat/[conversationId].
 * Full-screen layout: custom header with back arrow, user info, online dot.
 * Hides bottom nav for immersive chat experience.
 */
export default function ChatConversationPage({
  params: paramsPromise,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { user } = useAuth();
  const { chatSocket } = useSocket();
  const { setImmersive } = useImmersive();

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());

  const conversationId = parseInt(params.conversationId, 10);

  // Set immersive mode to hide bottom nav
  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  // Fetch conversation info
  useEffect(() => {
    if (isNaN(conversationId)) {
      setError(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchConversation() {
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        if (cancelled) return;
        setConversation(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchConversation();
    return () => { cancelled = true; };
  }, [conversationId]);

  // Mark conversation as read on mount
  useEffect(() => {
    if (chatSocket && !isNaN(conversationId)) {
      chatSocket.emit('conversation:read', { conversationId });
    }
  }, [chatSocket, conversationId]);

  // Presence tracking
  useEffect(() => {
    if (!chatSocket) return;

    const handleOnline = ({ userId: uid }: { userId: number }) => {
      setOnlineUsers((prev) => new Set(prev).add(uid));
    };
    const handleOffline = ({ userId: uid }: { userId: number }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    };

    chatSocket.on('presence:online', handleOnline);
    chatSocket.on('presence:offline', handleOffline);

    return () => {
      chatSocket.off('presence:online', handleOnline);
      chatSocket.off('presence:offline', handleOffline);
    };
  }, [chatSocket]);

  // Derive participants (excluding self)
  const participants: Participant[] = useMemo(() => {
    if (!conversation || !user) return [];
    return conversation.participants
      .filter((p) => p.user_id !== user.id)
      .map((p) => p.user);
  }, [conversation, user]);

  // Conversation display name
  const displayName = useMemo(() => {
    if (!conversation) return '';
    if (conversation.type === 'group') return conversation.name || 'Group Chat';
    return participants[0]?.display_name || 'Chat';
  }, [conversation, participants]);

  // Online status for the header (direct only)
  const isOtherOnline = useMemo(() => {
    if (!conversation || conversation.type !== 'direct') return false;
    const otherId = participants[0]?.id;
    return otherId ? onlineUsers.has(otherId) : false;
  }, [conversation, participants, onlineUsers]);

  // Error state
  if (error || isNaN(conversationId)) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-gray-900">
        <ChatHeader
          displayName="Not Found"
          onBack={() => router.push('/chat')}
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">Conversation not found</p>
            <button
              type="button"
              onClick={() => router.push('/chat')}
              className="mt-3 text-sm text-primary"
            >
              Back to messages
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading || !conversation) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-gray-900">
        <ChatHeader displayName="..." onBack={() => router.push('/chat')} />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <ChatHeader
        displayName={displayName}
        avatarUrl={
          conversation.type === 'direct'
            ? participants[0]?.avatar_url ?? null
            : conversation.avatar_url
        }
        avatarName={
          conversation.type === 'direct'
            ? participants[0]?.display_name || 'Chat'
            : displayName
        }
        avatarColor={
          conversation.type === 'direct'
            ? participants[0]?.avatar_color || '#3B82F6'
            : '#3B82F6'
        }
        isOnline={isOtherOnline}
        showOnline={conversation.type === 'direct'}
        onBack={() => router.push('/chat')}
      />

      {/* Chat view */}
      <ChatView
        conversationId={conversationId}
        conversationType={conversation.type}
        participants={participants}
        className="flex-1 min-h-0"
      />
    </div>
  );
}

// ---- Chat Header ----

interface ChatHeaderProps {
  displayName: string;
  avatarUrl?: string | null;
  avatarName?: string;
  avatarColor?: string;
  isOnline?: boolean;
  showOnline?: boolean;
  onBack: () => void;
}

function ChatHeader({
  displayName,
  avatarUrl,
  avatarName,
  avatarColor,
  isOnline = false,
  showOnline = false,
  onBack,
}: ChatHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 dark:border-gray-800',
        'bg-white dark:bg-gray-900 px-3'
      )}
    >
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 rounded-full p-1.5 text-gray-600 dark:text-gray-300 transition-colors hover:text-primary"
        aria-label="Back to messages"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {/* Avatar */}
      {avatarName && (
        <div className="relative shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={avatarName}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <InitialsAvatar
              name={avatarName}
              color={avatarColor || '#3B82F6'}
              size={36}
              className="text-sm"
            />
          )}
          {/* Online dot */}
          {showOnline && isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 bg-green-500" />
          )}
        </div>
      )}

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {displayName}
        </p>
        {showOnline && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isOnline ? 'Online' : 'Offline'}
          </p>
        )}
      </div>
    </header>
  );
}
