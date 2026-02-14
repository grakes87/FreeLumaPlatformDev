'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { useImmersive } from '@/context/ImmersiveContext';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface TargetUser {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

/**
 * New chat compose page at /chat/new?userId=X
 * Shows the target user header and a message input.
 * Conversation is only created when the first message is sent.
 */
export default function NewChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { setImmersive } = useImmersive();

  const targetUserId = searchParams.get('userId');

  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Immersive mode (hide bottom nav)
  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  // Fetch target user info
  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    async function fetchUser() {
      try {
        const res = await fetch(`/api/users/${targetUserId}/profile`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('User not found');
        const data = await res.json();
        setTargetUser({
          id: data.user.id,
          username: data.user.username,
          display_name: data.user.display_name,
          avatar_url: data.user.avatar_url,
          avatar_color: data.user.avatar_color,
        });
      } catch {
        setError('User not found');
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [targetUserId]);

  // Send first message — creates conversation + message in one flow
  const handleSend = useCallback(async () => {
    if (!message.trim() || !targetUser || sending) return;
    setSending(true);
    setError(null);

    try {
      // Step 1: Create or find conversation
      const convRes = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'direct',
          participant_ids: [targetUser.id],
        }),
      });

      let conversationId: number | null = null;

      if (convRes.ok) {
        const data = await convRes.json();
        conversationId = data.id;
      } else if (convRes.status === 202) {
        // Message request — conversation created but pending approval
        const data = await convRes.json();
        conversationId = data.conversation?.id;
      } else {
        const data = await convRes.json().catch(() => ({}));
        setError(data.error || 'Cannot message this user');
        setSending(false);
        return;
      }

      if (!conversationId) {
        setError('Failed to create conversation');
        setSending(false);
        return;
      }

      // Step 2: Send the message
      const msgRes = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: message.trim(), type: 'text' }),
      });

      if (msgRes.ok) {
        // Navigate to the conversation
        router.replace(`/chat/${conversationId}`);
      } else {
        setError('Failed to send message');
        setSending(false);
      }
    } catch {
      setError('Something went wrong');
      setSending(false);
    }
  }, [message, targetUser, sending, router]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-gray-900">
        <div className="flex h-14 items-center gap-3 border-b border-gray-200 dark:border-gray-800 px-3">
          <button type="button" onClick={() => router.back()} className="p-1.5 text-gray-600 dark:text-gray-300">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Message</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!targetUser || !targetUserId) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-gray-900">
        <div className="flex h-14 items-center gap-3 border-b border-gray-200 dark:border-gray-800 px-3">
          <button type="button" onClick={() => router.back()} className="p-1.5 text-gray-600 dark:text-gray-300">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Message</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">{error || 'User not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="shrink-0 rounded-full p-1.5 text-gray-600 dark:text-gray-300 transition-colors hover:text-primary"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex flex-1 items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {targetUser.avatar_url ? (
              <img
                src={targetUser.avatar_url}
                alt={targetUser.display_name}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <InitialsAvatar
                name={targetUser.display_name}
                color={targetUser.avatar_color || '#3B82F6'}
                size={36}
                className="text-sm"
              />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {targetUser.display_name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">New message</p>
          </div>
        </div>
      </header>

      {/* Empty chat area */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-3">
            {targetUser.avatar_url ? (
              <img
                src={targetUser.avatar_url}
                alt={targetUser.display_name}
                className="h-16 w-16 rounded-full object-cover mx-auto"
              />
            ) : (
              <InitialsAvatar
                name={targetUser.display_name}
                color={targetUser.avatar_color || '#3B82F6'}
                size={64}
                className="text-xl mx-auto"
              />
            )}
          </div>
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {targetUser.display_name}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Send a message to start a conversation
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 text-center">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Message input */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-2xl border border-gray-200 dark:border-gray-700',
              'bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm',
              'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
              'focus:outline-none focus:ring-1 focus:ring-primary',
              'max-h-32'
            )}
            style={{ minHeight: 40 }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className={cn(
              'shrink-0 flex h-10 w-10 items-center justify-center rounded-full transition-colors',
              message.trim() && !sending
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
            )}
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
