import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Conversation,
  ConversationParticipant,
  User,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const USER_ATTRIBUTES = ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'] as const;

/**
 * GET /api/chat/conversations/[id]
 * Get conversation detail with participants.
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

      // Verify user is a participant
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

      const conversation = await Conversation.findByPk(conversationId, {
        include: [
          {
            model: ConversationParticipant,
            as: 'participants',
            where: { deleted_at: null },
            required: false,
            include: [
              {
                model: User,
                as: 'user',
                attributes: [...USER_ATTRIBUTES],
              },
            ],
          },
        ],
      });

      if (!conversation) {
        return errorResponse('Conversation not found', 404);
      }

      return successResponse(conversation);
    } catch (error) {
      return serverError(error, 'Failed to fetch conversation');
    }
  }
);

const updateConversationSchema = z.object({
  name: z.string().max(100).optional(),
  avatar_url: z.string().max(500).nullable().optional(),
});

/**
 * PUT /api/chat/conversations/[id]
 * Update group conversation name or avatar. Creator only.
 */
export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const conversationId = parseInt(params.id, 10);
      if (isNaN(conversationId)) {
        return errorResponse('Invalid conversation ID');
      }

      const userId = context.user.id;

      const conversation = await Conversation.findByPk(conversationId, {
        attributes: ['id', 'type', 'creator_id'],
      });

      if (!conversation) {
        return errorResponse('Conversation not found', 404);
      }

      if (conversation.type !== 'group') {
        return errorResponse('Can only update group conversations');
      }

      if (conversation.creator_id !== userId) {
        return errorResponse('Only the group creator can update group settings', 403);
      }

      const json = await req.json();
      const parsed = updateConversationSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.avatar_url !== undefined) updates.avatar_url = parsed.data.avatar_url;

      if (Object.keys(updates).length === 0) {
        return errorResponse('No fields to update');
      }

      await Conversation.update(updates, { where: { id: conversationId } });

      // Emit Socket.IO event
      try {
        const { getIO } = await import('@/lib/socket/index');
        const io = getIO();
        const chatNsp = io.of('/chat');
        chatNsp.to(`conv:${conversationId}`).emit('conversation:updated', {
          conversation_id: conversationId,
          ...updates,
        });
      } catch {
        // Socket.IO not available
      }

      return successResponse({ message: 'Group updated' });
    } catch (error) {
      return serverError(error, 'Failed to update conversation');
    }
  }
);

/**
 * DELETE /api/chat/conversations/[id]
 * Soft delete: sets deleted_at on participant record for the current user.
 * Does NOT delete the conversation or affect other participants.
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

      await participation.update({ deleted_at: new Date() });

      return successResponse({ message: 'Conversation deleted' });
    } catch (error) {
      return serverError(error, 'Failed to delete conversation');
    }
  }
);
