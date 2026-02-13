import { NextRequest } from 'next/server';
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
