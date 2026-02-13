import type { Namespace, Socket } from 'socket.io';
import { Op } from 'sequelize';
import { presenceManager } from '@/lib/socket/presence';

/**
 * Register all /chat namespace event handlers on a connected socket.
 * Handles: conversation room management, typing indicators, read receipts,
 * message reaction broadcasts, and online/offline presence.
 */
export function registerChatHandlers(nsp: Namespace, socket: Socket): void {
  const userId = socket.data.userId as number;

  // --- On connect: auto-join all active conversation rooms + broadcast presence ---
  handleConnect(nsp, socket, userId);

  // --- conversation:join ---
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

      // Broadcast presence to conversation room
      socket.to(`conv:${conversationId}`).emit('presence:online', { userId });
    } catch (err) {
      console.error('[Chat] conversation:join error:', err);
    }
  });

  // --- conversation:leave ---
  socket.on('conversation:leave', ({ conversationId }: { conversationId: number }) => {
    socket.leave(`conv:${conversationId}`);
  });

  // --- typing:start (volatile - droppable) ---
  socket.on('typing:start', ({ conversationId }: { conversationId: number }) => {
    socket.to(`conv:${conversationId}`).volatile.emit('typing:start', { userId });
  });

  // --- typing:stop (volatile - droppable) ---
  socket.on('typing:stop', ({ conversationId }: { conversationId: number }) => {
    socket.to(`conv:${conversationId}`).volatile.emit('typing:stop', { userId });
  });

  // --- conversation:read (batch read receipts) ---
  socket.on('conversation:read', async ({ conversationId }: { conversationId: number }) => {
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
      // Reaction persistence happens via API route (03-04);
      // this socket event just broadcasts the real-time update
      socket.to(`conv:${conversationId}`).emit('message:reaction', {
        messageId,
        userId,
        reactionType,
      });
    }
  );

  // --- disconnect: remove presence + broadcast offline ---
  socket.on('disconnect', async () => {
    const wentOffline = presenceManager.removeSocket(userId, socket.id);

    if (wentOffline) {
      try {
        const { ConversationParticipant } = await import('@/lib/db/models');
        const participations = await ConversationParticipant.findAll({
          attributes: ['conversation_id'],
          where: {
            user_id: userId,
            deleted_at: null,
          },
        });

        for (const p of participations) {
          nsp.to(`conv:${p.conversation_id}`).emit('presence:offline', { userId });
        }
      } catch (err) {
        console.error('[Chat] disconnect presence broadcast error:', err);
      }
    }
  });
}

/**
 * Handle initial connection: auto-join all active conversation rooms
 * and broadcast online presence to participants.
 */
async function handleConnect(nsp: Namespace, socket: Socket, userId: number): Promise<void> {
  try {
    const { ConversationParticipant } = await import('@/lib/db/models');

    // Find all conversations the user is a participant in
    const participations = await ConversationParticipant.findAll({
      attributes: ['conversation_id'],
      where: {
        user_id: userId,
        deleted_at: null,
      },
    });

    // Auto-join all conversation rooms
    for (const p of participations) {
      const room = `conv:${p.conversation_id}`;
      socket.join(room);
    }

    // Broadcast online presence to all conversation rooms
    for (const p of participations) {
      socket.to(`conv:${p.conversation_id}`).emit('presence:online', { userId });
    }
  } catch (err) {
    console.error('[Chat] handleConnect error:', err);
  }
}
