import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  MessageRequest,
  Conversation,
  ConversationParticipant,
  Message,
  User,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const USER_ATTRIBUTES = ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'] as const;

const actionSchema = z.object({
  request_id: z.number().int().positive(),
  action: z.enum(['accept', 'decline']),
});

/**
 * GET /api/chat/requests
 * List pending message requests where the current user is the recipient.
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;

      const requests = await MessageRequest.findAll({
        where: {
          recipient_id: userId,
          status: 'pending',
        },
        include: [
          {
            model: User,
            as: 'requester',
            attributes: [...USER_ATTRIBUTES],
          },
          {
            model: Conversation,
            as: 'conversation',
            attributes: ['id', 'created_at'],
            include: [
              {
                model: Message,
                as: 'messages',
                limit: 1,
                order: [['created_at', 'ASC']],
                attributes: ['id', 'content', 'type', 'created_at'],
              },
            ],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      const formatted = requests.map((r) => {
        const rJson = r.toJSON() as unknown as Record<string, unknown>;
        const conv = rJson.conversation as { messages?: Array<{ content: string | null; type: string }> } | undefined;
        const firstMessage = conv?.messages?.[0] ?? null;

        return {
          id: r.id,
          requester: rJson.requester,
          conversation_id: r.conversation_id,
          preview: firstMessage?.content
            ? firstMessage.content.length > 100
              ? firstMessage.content.slice(0, 100) + '...'
              : firstMessage.content
            : null,
          message_type: firstMessage?.type ?? null,
          created_at: r.created_at,
        };
      });

      return successResponse({ requests: formatted });
    } catch (error) {
      return serverError(error, 'Failed to fetch message requests');
    }
  }
);

/**
 * POST /api/chat/requests
 * Accept or decline a message request.
 * Accept: updates status and keeps conversation active.
 * Decline: updates status silently (requester not notified).
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;
      const json = await req.json();
      const parsed = actionSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { request_id, action } = parsed.data;

      const request = await MessageRequest.findOne({
        where: {
          id: request_id,
          recipient_id: userId,
          status: 'pending',
        },
      });

      if (!request) {
        return errorResponse('Message request not found', 404);
      }

      if (action === 'accept') {
        await request.update({ status: 'accepted' });

        // Ensure participant records are active
        await ConversationParticipant.update(
          { deleted_at: null },
          {
            where: {
              conversation_id: request.conversation_id,
              deleted_at: { [Op.ne]: null },
            },
          }
        );

        return successResponse({
          message: 'Message request accepted',
          conversation_id: request.conversation_id,
        });
      }

      // Decline
      await request.update({ status: 'declined' });

      return successResponse({ message: 'Message request declined' });
    } catch (error) {
      return serverError(error, 'Failed to process message request');
    }
  }
);
