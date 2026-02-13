import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Conversation,
  ConversationParticipant,
  Message,
  MessageMedia,
  MessageStatus,
  MessageReaction,
  User,
  Post,
  PostMedia,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { getBlockedUserIds } from '@/lib/utils/blocks';
import { checkAndFlag } from '@/lib/moderation/profanity';

const USER_ATTRIBUTES = ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'] as const;
const PAGE_SIZE = 30;

const createMessageSchema = z.object({
  content: z.string().max(5000).optional(),
  type: z.enum(['text', 'media', 'voice', 'shared_post']).default('text'),
  reply_to_id: z.number().int().positive().nullable().optional(),
  shared_post_id: z.number().int().positive().nullable().optional(),
  mentioned_user_ids: z.array(z.number().int().positive()).max(50).optional(),
  media: z
    .array(
      z.object({
        media_url: z.string().url(),
        media_type: z.enum(['image', 'video', 'voice']),
        duration: z.number().int().positive().nullable().optional(),
        sort_order: z.number().int().min(0).optional(),
      })
    )
    .max(10)
    .optional(),
});

const deleteMessageSchema = z.object({
  message_id: z.number().int().positive(),
});

/**
 * GET /api/chat/conversations/[id]/messages
 * Fetch messages for a conversation with cursor-based pagination (newest first).
 * Updates last_read_at for the current user (batch read receipt).
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const conversationId = parseInt(params.id, 10);
      if (isNaN(conversationId)) {
        return errorResponse('Invalid conversation ID');
      }

      const userId = context.user.id;

      // Verify user is participant
      const participation = await ConversationParticipant.findOne({
        where: {
          conversation_id: conversationId,
          user_id: userId,
          deleted_at: null,
        },
      });

      if (!participation) {
        return errorResponse('Conversation not found', 404);
      }

      const { searchParams } = new URL(req.url);
      const cursor = searchParams.get('cursor');
      const limit = Math.min(
        parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10),
        50
      );

      // Get blocked user IDs
      const blockedIds = await getBlockedUserIds(userId);
      const blockedArray = [...blockedIds];

      // Build where clause
      const where: Record<string, unknown> = {
        conversation_id: conversationId,
      };

      if (cursor) {
        where.id = { [Op.lt]: parseInt(cursor, 10) };
      }

      if (blockedArray.length > 0) {
        where.sender_id = { [Op.notIn]: blockedArray };
      }

      const messages = await Message.findAll({
        where,
        include: [
          {
            model: User,
            as: 'sender',
            attributes: [...USER_ATTRIBUTES],
          },
          {
            model: MessageMedia,
            as: 'media',
            attributes: ['id', 'media_url', 'media_type', 'duration', 'sort_order'],
          },
          {
            model: Message,
            as: 'replyTo',
            attributes: ['id', 'content', 'type', 'sender_id', 'is_unsent'],
            include: [
              {
                model: User,
                as: 'sender',
                attributes: ['id', 'display_name'],
              },
            ],
          },
          {
            model: Post,
            as: 'sharedPost',
            attributes: ['id', 'body', 'post_type', 'user_id'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color'],
              },
              {
                model: PostMedia,
                as: 'media',
                attributes: ['id', 'url', 'media_type', 'thumbnail_url'],
                limit: 1,
              },
            ],
          },
          {
            model: MessageReaction,
            as: 'reactions',
            attributes: ['id', 'user_id', 'reaction_type'],
          },
          {
            model: MessageStatus,
            as: 'statuses',
            attributes: ['user_id', 'status'],
          },
        ],
        order: [['created_at', 'DESC']],
        limit: limit + 1,
      });

      const hasMore = messages.length > limit;
      const results = hasMore ? messages.slice(0, limit) : messages;

      // Format messages with grouped reactions and status
      const formatted = results.map((msg) => {
        const msgJson = msg.toJSON() as unknown as Record<string, unknown>;
        const reactions = (msgJson.reactions ?? []) as Array<{ user_id: number; reaction_type: string }>;
        const statuses = (msgJson.statuses ?? []) as Array<{ user_id: number; status: string }>;

        // Group reactions by type
        const reactionGroups: Record<string, { count: number; reacted: boolean }> = {};
        for (const r of reactions) {
          if (!reactionGroups[r.reaction_type]) {
            reactionGroups[r.reaction_type] = { count: 0, reacted: false };
          }
          reactionGroups[r.reaction_type].count++;
          if (r.user_id === userId) {
            reactionGroups[r.reaction_type].reacted = true;
          }
        }

        // Determine message delivery status
        let deliveryStatus: 'sent' | 'delivered' | 'read' = 'sent';
        if (statuses.length > 0) {
          const allRead = statuses.every((s) => s.status === 'read');
          deliveryStatus = allRead ? 'read' : 'delivered';
        }

        // Handle unsent messages
        if (msg.is_unsent) {
          return {
            ...msgJson,
            content: null,
            media: [],
            reactions: reactionGroups,
            delivery_status: deliveryStatus,
          };
        }

        return {
          ...msgJson,
          reactions: reactionGroups,
          delivery_status: deliveryStatus,
          statuses: undefined, // Remove raw statuses from response
        };
      });

      const nextCursor =
        results.length > 0 ? String(results[results.length - 1].id) : null;

      // Update last_read_at for batch read receipt
      await participation.update({ last_read_at: new Date() });

      return successResponse({
        messages: formatted,
        has_more: hasMore,
        next_cursor: nextCursor,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch messages');
    }
  }
);

/**
 * POST /api/chat/conversations/[id]/messages
 * Send a new message in a conversation.
 * Creates message, media rows, status rows, updates conversation, and emits Socket.IO event.
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const conversationId = parseInt(params.id, 10);
      if (isNaN(conversationId)) {
        return errorResponse('Invalid conversation ID');
      }

      const userId = context.user.id;

      // Verify user is participant
      const participation = await ConversationParticipant.findOne({
        where: {
          conversation_id: conversationId,
          user_id: userId,
          deleted_at: null,
        },
      });

      if (!participation) {
        return errorResponse('Conversation not found', 404);
      }

      const json = await req.json();
      const parsed = createMessageSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { content, type, reply_to_id, shared_post_id, media, mentioned_user_ids } = parsed.data;

      // Validate content requirement
      if (type === 'text' && !content) {
        return errorResponse('Text messages require content');
      }

      // Validate reply_to exists in same conversation
      if (reply_to_id) {
        const replyTarget = await Message.findOne({
          where: { id: reply_to_id, conversation_id: conversationId },
          attributes: ['id'],
        });
        if (!replyTarget) {
          return errorResponse('Reply target message not found', 404);
        }
      }

      // Validate shared post exists
      if (shared_post_id) {
        const post = await Post.findByPk(shared_post_id, { attributes: ['id'] });
        if (!post) {
          return errorResponse('Shared post not found', 404);
        }
      }

      // Profanity check on content
      let flagged = false;
      if (content) {
        const result = checkAndFlag(content);
        flagged = result.flagged;
      }

      // Create message
      const message = await Message.create({
        conversation_id: conversationId,
        sender_id: userId,
        type,
        content: content || null,
        reply_to_id: reply_to_id || null,
        shared_post_id: shared_post_id || null,
        flagged,
      });

      // Create media rows
      if (media && media.length > 0) {
        await MessageMedia.bulkCreate(
          media.map((m, index) => ({
            message_id: message.id,
            media_url: m.media_url,
            media_type: m.media_type,
            duration: m.duration ?? null,
            sort_order: m.sort_order ?? index,
          }))
        );
      }

      // Create MessageStatus rows for other participants
      const otherParticipants = await ConversationParticipant.findAll({
        where: {
          conversation_id: conversationId,
          user_id: { [Op.ne]: userId },
          deleted_at: null,
        },
        attributes: ['user_id'],
      });

      if (otherParticipants.length > 0) {
        await MessageStatus.bulkCreate(
          otherParticipants.map((p) => ({
            message_id: message.id,
            user_id: p.user_id,
            status: 'delivered' as const,
          }))
        );
      }

      // Update conversation last_message
      await Conversation.update(
        {
          last_message_id: message.id,
          last_message_at: message.created_at,
        },
        { where: { id: conversationId } }
      );

      // Restore deleted_at for participants who soft-deleted (new message restores conversation)
      await ConversationParticipant.update(
        { deleted_at: null },
        {
          where: {
            conversation_id: conversationId,
            deleted_at: { [Op.ne]: null },
          },
        }
      );

      // Reload message with full associations
      const fullMessage = await Message.findByPk(message.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: [...USER_ATTRIBUTES],
          },
          {
            model: MessageMedia,
            as: 'media',
            attributes: ['id', 'media_url', 'media_type', 'duration', 'sort_order'],
          },
          {
            model: Message,
            as: 'replyTo',
            attributes: ['id', 'content', 'type', 'sender_id', 'is_unsent'],
            include: [
              {
                model: User,
                as: 'sender',
                attributes: ['id', 'display_name'],
              },
            ],
          },
        ],
      });

      // Emit Socket.IO event for real-time delivery
      try {
        const { getIO } = await import('@/lib/socket/index');
        const io = getIO();
        const chatNsp = io.of('/chat');
        chatNsp.to(`conv:${conversationId}`).emit('message:new', fullMessage?.toJSON());
      } catch {
        // Socket.IO not available (e.g., during build or test) — skip silently
      }

      // Create mention notifications for @mentioned users
      if (mentioned_user_ids && mentioned_user_ids.length > 0) {
        try {
          const { createNotification } = await import('@/lib/notifications/create');
          const { NotificationType, NotificationEntityType } = await import('@/lib/notifications/types');

          // Only notify participants who are actually mentioned
          const participantUserIds = otherParticipants.map((p) => p.user_id);
          const validMentionIds = mentioned_user_ids.filter((id) => participantUserIds.includes(id));

          const preview = content ? (content.length > 100 ? content.slice(0, 100) + '...' : content) : null;

          await Promise.all(
            validMentionIds.map((mentionedId) =>
              createNotification({
                recipient_id: mentionedId,
                actor_id: userId,
                type: NotificationType.MENTION,
                entity_type: NotificationEntityType.MESSAGE,
                entity_id: message.id,
                preview_text: preview,
              })
            )
          );
        } catch (err) {
          console.error('[Messages] mention notification error:', err);
          // Non-fatal: message was sent successfully
        }
      }

      return successResponse(fullMessage, 201);
    } catch (error) {
      return serverError(error, 'Failed to send message');
    }
  }
);

/**
 * DELETE /api/chat/conversations/[id]/messages
 * Unsend a message (set is_unsent=true). Only the sender can unsend.
 * Emits "message:unsent" Socket.IO event.
 */
export const DELETE = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const conversationId = parseInt(params.id, 10);
      if (isNaN(conversationId)) {
        return errorResponse('Invalid conversation ID');
      }

      const userId = context.user.id;

      // Verify user is participant
      const participation = await ConversationParticipant.findOne({
        where: {
          conversation_id: conversationId,
          user_id: userId,
          deleted_at: null,
        },
      });

      if (!participation) {
        return errorResponse('Conversation not found', 404);
      }

      const json = await req.json();
      const parsed = deleteMessageSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { message_id } = parsed.data;

      const message = await Message.findOne({
        where: {
          id: message_id,
          conversation_id: conversationId,
        },
      });

      if (!message) {
        return errorResponse('Message not found', 404);
      }

      if (message.sender_id !== userId) {
        return errorResponse('Only the sender can unsend a message', 403);
      }

      if (message.is_unsent) {
        return errorResponse('Message already unsent');
      }

      await message.update({ is_unsent: true });

      // Emit Socket.IO event
      try {
        const { getIO } = await import('@/lib/socket/index');
        const io = getIO();
        const chatNsp = io.of('/chat');
        chatNsp.to(`conv:${conversationId}`).emit('message:unsent', {
          message_id: message.id,
          conversation_id: conversationId,
        });
      } catch {
        // Socket.IO not available — skip silently
      }

      return successResponse({ message: 'Message unsent' });
    } catch (error) {
      return serverError(error, 'Failed to unsend message');
    }
  }
);
