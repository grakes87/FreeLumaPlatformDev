import type { Namespace, Socket } from 'socket.io';
import { Op } from 'sequelize';
import { presenceManager } from '@/lib/socket/presence';

/** Simple per-socket sliding-window rate limiter. */
function createRateLimiter(maxPerWindow: number, windowMs: number) {
  const timestamps: number[] = [];
  return (): boolean => {
    const now = Date.now();
    // Remove timestamps outside the window
    while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
      timestamps.shift();
    }
    if (timestamps.length >= maxPerWindow) return false;
    timestamps.push(now);
    return true;
  };
}

/**
 * Register all /chat namespace event handlers on a connected socket.
 * Handles: conversation room management, typing indicators, read receipts,
 * message reaction broadcasts, and online/offline presence.
 */
export function registerChatHandlers(nsp: Namespace, socket: Socket): void {
  const userId = socket.data.userId as number;

  // Per-socket rate limiters
  const typingLimiter = createRateLimiter(5, 3000);    // 5 events per 3s
  const reactionLimiter = createRateLimiter(10, 5000);  // 10 events per 5s
  const readLimiter = createRateLimiter(5, 3000);       // 5 events per 3s

  // Track which conversations this socket is viewing (for disconnect presence)
  const activeConversations = new Set<number>();

  // --- conversation:join (lazy — only when user opens a chat view) ---
  socket.on('conversation:join', async ({ conversationId }: { conversationId: number }) => {
    try {
      const { ConversationParticipant } = await import('@/lib/db/models');
      const participant = await ConversationParticipant.findOne({
        where: {
          conversation_id: conversationId,
          user_id: userId,
          deleted_at: null,
        },
      });

      // Silently ignore if not a participant (security: don't leak existence)
      if (!participant) return;

      socket.join(`conv:${conversationId}`);
      activeConversations.add(conversationId);
      console.log('[Chat] user', userId, 'joined conv:', conversationId, 'rooms:', Array.from(socket.rooms));

      // Broadcast presence to conversation room
      socket.to(`conv:${conversationId}`).emit('presence:online', { userId });
    } catch (err) {
      console.error('[Chat] conversation:join error:', err);
    }
  });

  // --- conversation:leave ---
  socket.on('conversation:leave', ({ conversationId }: { conversationId: number }) => {
    socket.leave(`conv:${conversationId}`);
    activeConversations.delete(conversationId);
  });

  // --- typing:start (volatile - droppable) ---
  socket.on('typing:start', ({ conversationId }: { conversationId: number }) => {
    if (!socket.rooms.has(`conv:${conversationId}`)) return;
    if (!typingLimiter()) return;
    socket.to(`conv:${conversationId}`).volatile.emit('typing:start', { userId, conversationId });
  });

  // --- typing:stop (volatile - droppable) ---
  socket.on('typing:stop', ({ conversationId }: { conversationId: number }) => {
    if (!socket.rooms.has(`conv:${conversationId}`)) return;
    if (!typingLimiter()) return;
    socket.to(`conv:${conversationId}`).volatile.emit('typing:stop', { userId, conversationId });
  });

  // --- conversation:read (batch read receipts) ---
  socket.on('conversation:read', async ({ conversationId }: { conversationId: number }) => {
    if (!readLimiter()) return;
    try {
      const { ConversationParticipant, Conversation, MessageStatus, Message } =
        await import('@/lib/db/models');

      const now = new Date();

      // Update last_read_at on the participant record
      await ConversationParticipant.update(
        { last_read_at: now },
        {
          where: {
            conversation_id: conversationId,
            user_id: userId,
            deleted_at: null,
          },
        }
      );

      // For 1:1 conversations: batch-update MessageStatus to 'read'
      const conversation = await Conversation.findByPk(conversationId, {
        attributes: ['id', 'type'],
      });

      if (conversation?.type === 'direct') {
        // Find all unread messages from the other sender in this conversation
        const unreadMessages = await Message.findAll({
          attributes: ['id'],
          where: {
            conversation_id: conversationId,
            sender_id: { [Op.ne]: userId },
          },
          include: [
            {
              model: MessageStatus,
              as: 'statuses',
              required: true,
              where: {
                user_id: userId,
                status: 'delivered',
              },
              attributes: ['id'],
            },
          ],
        });

        if (unreadMessages.length > 0) {
          const messageIds = unreadMessages.map((m) => m.id);
          await MessageStatus.update(
            { status: 'read', status_at: now },
            {
              where: {
                message_id: { [Op.in]: messageIds },
                user_id: userId,
              },
            }
          );
        }
      }

      // Broadcast read receipt to conversation room
      socket.to(`conv:${conversationId}`).emit('messages:read', {
        userId,
        conversationId,
        readAt: now.toISOString(),
      });
    } catch (err) {
      console.error('[Chat] conversation:read error:', err);
    }
  });

  // --- message:react (broadcast real-time reaction update) ---
  socket.on(
    'message:react',
    ({ messageId, conversationId, reactionType }: { messageId: number; conversationId: number; reactionType: string }) => {
      if (!socket.rooms.has(`conv:${conversationId}`)) return;
      if (!reactionLimiter()) return;
      // Reaction persistence happens via API route (03-04);
      // this socket event just broadcasts the real-time update
      socket.to(`conv:${conversationId}`).emit('message:reaction', {
        messageId,
        userId,
        reactionType,
      });
    }
  );

  // --- disconnect: remove presence + broadcast offline to active rooms ---
  socket.on('disconnect', () => {
    const wentOffline = presenceManager.removeSocket(userId, socket.id);

    if (wentOffline) {
      // Only broadcast offline to conversations this socket was actively viewing.
      // No DB query needed — we tracked joins in activeConversations.
      for (const convId of activeConversations) {
        nsp.to(`conv:${convId}`).emit('presence:offline', { userId });
      }
    }

    activeConversations.clear();
  });
}
