'use client';

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useImmersive } from '@/context/ImmersiveContext';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { ChatView } from '@/components/chat/ChatView';
import { GroupInfoSheet } from '@/components/chat/GroupInfoSheet';

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
  creator_id: number | null;
  participants: Array<{
    id: number;
    user_id: number;
    role: 'member' | 'admin';
    user: Participant;
  }>;
}

/**
 * Individual chat conversation page at /chat/[conversationId].
 * Full-screen layout: custom header with back arrow, user info, online dot.
 * Hides bottom nav for immersive chat experience.
 * For group conversations, tapping header opens GroupInfoSheet.
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
  const [blocked, setBlocked] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const conversationId = parseInt(params.conversationId, 10);

  // Set immersive mode to hide bottom nav
  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  // Fetch conversation info and check for blocks
  const fetchConversation = useCallback(async () => {
    if (isNaN(conversationId)) {
      setError(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        credentials: 'include',
      });
      if (res.status === 403) {
        // Blocked or unavailable
        setBlocked(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setConversation(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

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

  // Derive all participants (for group info)
  const allParticipants = useMemo(() => {
    if (!conversation) return [];
    return conversation.participants;
  }, [conversation]);

  // Derive participants (excluding self) for display
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

  // isOnline function for group info sheet
  const isOnline = useCallback(
    (userId: number) => onlineUsers.has(userId),
    [onlineUsers]
  );

  // Group member count for header subtitle
  const memberCount = useMemo(() => {
    if (!conversation || conversation.type !== 'group') return 0;
    return allParticipants.length;
  }, [conversation, allParticipants]);

  // Handle group updated (re-fetch conversation)
  const handleGroupUpdated = useCallback(() => {
    fetchConversation();
  }, [fetchConversation]);

  // Blocked state
  if (blocked) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-gray-900">
        <ChatHeader
          displayName="Unavailable"
          onBack={() => router.push('/chat')}
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center px-6">
            <p className="text-gray-500 dark:text-gray-400">
              This conversation is unavailable
            </p>
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
        isGroup={conversation.type === 'group'}
        memberCount={memberCount}
        onBack={() => router.push('/chat')}
        onTapInfo={() => setShowGroupInfo(true)}
      />

      {/* Chat view */}
      <ChatView
        conversationId={conversationId}
        conversationType={conversation.type}
        participants={participants}
        className="flex-1 min-h-0"
      />

      {/* Group info sheet */}
      {conversation.type === 'group' && user && (
        <GroupInfoSheet
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          conversationId={conversationId}
          conversationName={conversation.name}
          conversationAvatarUrl={conversation.avatar_url}
          creatorId={conversation.creator_id}
          currentUserId={user.id}
          participants={allParticipants}
          isOnline={isOnline}
          onGroupUpdated={handleGroupUpdated}
        />
      )}
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
  isGroup?: boolean;
  memberCount?: number;
  onBack: () => void;
  onTapInfo?: () => void;
}

function ChatHeader({
  displayName,
  avatarUrl,
  avatarName,
  avatarColor,
  isOnline = false,
  showOnline = false,
  isGroup = false,
  memberCount = 0,
  onBack,
  onTapInfo,
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

      {/* Tappable area for group info */}
      <button
        type="button"
        onClick={isGroup ? onTapInfo : undefined}
        className={cn(
          'flex flex-1 items-center gap-3 min-w-0',
          isGroup && 'cursor-pointer'
        )}
        disabled={!isGroup}
      >
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
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {displayName}
          </p>
          {showOnline && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isOnline ? 'Online' : 'Offline'}
            </p>
          )}
          {isGroup && memberCount > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {memberCount} member{memberCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </button>

      {/* Group info icon */}
      {isGroup && onTapInfo && (
        <button
          type="button"
          onClick={onTapInfo}
          className="shrink-0 rounded-full p-1.5 text-gray-500 dark:text-gray-400 transition-colors hover:text-primary"
          aria-label="Group info"
        >
          <Users className="h-5 w-5" />
        </button>
      )}
    </header>
  );
}
