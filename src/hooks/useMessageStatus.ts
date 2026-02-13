'use client';

import { useMemo } from 'react';
import type { ChatMessage } from '@/hooks/useChat';

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';

/**
 * Hook to retrieve the delivery status for a specific message.
 * In 1:1 conversations, tracks sent/delivered/read from the API response.
 * Status is already computed server-side in the `delivery_status` field
 * and updated in real-time by useChat's Socket.IO listeners.
 *
 * @param message - The chat message to check status for
 * @param isOwnMessage - Whether the current user sent this message
 * @param conversationType - 'direct' or 'group'
 */
export function useMessageStatus(
  message: ChatMessage,
  isOwnMessage: boolean,
  conversationType: 'direct' | 'group'
): MessageDeliveryStatus | null {
  return useMemo(() => {
    // Only show status for own messages in 1:1 conversations
    if (!isOwnMessage || conversationType !== 'direct') return null;
    // Optimistic messages are always "sent"
    if (message._optimistic) return 'sent';
    return message.delivery_status ?? 'sent';
  }, [message.delivery_status, message._optimistic, isOwnMessage, conversationType]);
}

/**
 * Get the status icon description for display.
 */
export function getStatusLabel(status: MessageDeliveryStatus | null): string {
  switch (status) {
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'read':
      return 'Read';
    default:
      return '';
  }
}
