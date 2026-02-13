import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Conversation,
  ConversationParticipant,
  Message,
  MessageRequest,
  User,
  UserSetting,
  Follow,
  sequelize,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { getBlockedUserIds } from '@/lib/utils/blocks';

const USER_ATTRIBUTES = ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'] as const;

const createConversationSchema = z.object({
  type: z.enum(['direct', 'group']),
  participant_ids: z.array(z.number().int().positive()).min(1),
  name: z.string().max(100).optional(),
  avatar_url: z.string().max(500).nullable().optional(),
});

/**
 * GET /api/chat/conversations
 * List all conversations for the authenticated user.
 * Includes last message preview, other participants, and unread count.
 * Returns message requests separately.
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;
      const { searchParams } = new URL(req.url);
      const search = searchParams.get('search')?.trim();

      // Get blocked user IDs for filtering
      const blockedIds = await getBlockedUserIds(userId);
      const blockedArray = [...blockedIds];

      // Find all conversation IDs where user is an active participant
      const myParticipations = await ConversationParticipant.findAll({
        where: {
          user_id: userId,
          deleted_at: null,
        },
        attributes: ['conversation_id', 'last_read_at'],
        raw: true,
      });

      if (myParticipations.length === 0) {
        return successResponse({ conversations: [], messageRequests: [] });
      }

      const conversationIds = myParticipations.map((p) => p.conversation_id);
      const lastReadMap = new Map(
        myParticipations.map((p) => [p.conversation_id, p.last_read_at])
      );

      // If search query, find matching users first and filter conversations
      let filteredConversationIds = conversationIds;
      if (search) {
        const matchingParticipants = await ConversationParticipant.findAll({
          where: {
            conversation_id: { [Op.in]: conversationIds },
            user_id: { [Op.ne]: userId },
          },
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id'],
              where: {
                [Op.or]: [
                  { display_name: { [Op.like]: `%${search}%` } },
                  { username: { [Op.like]: `%${search}%` } },
                ],
              },
            },
          ],
          attributes: ['conversation_id'],
          raw: true,
        });
        filteredConversationIds = matchingParticipants.map(
          (p) => (p as unknown as { conversation_id: number }).conversation_id
        );

        if (filteredConversationIds.length === 0) {
          return successResponse({ conversations: [], messageRequests: [] });
        }
      }

      // Fetch conversations with last message
      const conversations = await Conversation.findAll({
        where: {
          id: { [Op.in]: filteredConversationIds },
        },
        include: [
          {
            model: ConversationParticipant,
            as: 'participants',
            where: {
              deleted_at: null,
              ...(blockedArray.length > 0
                ? { user_id: { [Op.notIn]: blockedArray } }
                : {}),
            },
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
        order: [['last_message_at', 'DESC']],
      });

      // Get last message for each conversation
      const lastMessageIds = conversations
        .map((c) => c.last_message_id)
        .filter((id): id is number => id !== null);

      let lastMessagesMap = new Map<number, { content: string | null; sender_display_name: string | null; type: string }>();
      if (lastMessageIds.length > 0) {
        const lastMessages = await Message.findAll({
          where: { id: { [Op.in]: lastMessageIds } },
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['display_name'],
            },
          ],
          attributes: ['id', 'content', 'type', 'is_unsent'],
        });
        for (const msg of lastMessages) {
          const sender = (msg as unknown as { sender?: { display_name: string } }).sender;
          lastMessagesMap.set(msg.id, {
            content: msg.is_unsent ? null : msg.content,
            sender_display_name: sender?.display_name ?? null,
            type: msg.type,
          });
        }
      }

      // Calculate unread counts
      const unreadCounts = new Map<number, number>();
      for (const convId of filteredConversationIds) {
        const lastRead = lastReadMap.get(convId);
        const whereClause: Record<string, unknown> = {
          conversation_id: convId,
          sender_id: { [Op.ne]: userId },
        };
        if (lastRead) {
          whereClause.created_at = { [Op.gt]: lastRead };
        }
        if (blockedArray.length > 0) {
          whereClause.sender_id = {
            ...(typeof whereClause.sender_id === 'object' ? whereClause.sender_id as object : {}),
            [Op.notIn]: blockedArray,
          };
        }

        const count = await Message.count({ where: whereClause });
        unreadCounts.set(convId, count);
      }

      // Format response
      const formattedConversations = conversations.map((conv) => {
        const convJson = conv.toJSON() as unknown as Record<string, unknown>;
        const participants = (convJson.participants ?? []) as Array<{ user_id: number; user: unknown }>;
        const otherParticipants = participants
          .filter((p) => p.user_id !== userId)
          .map((p) => p.user);

        const lastMsg = conv.last_message_id
          ? lastMessagesMap.get(conv.last_message_id)
          : null;

        let preview: string | null = null;
        if (lastMsg) {
          if (lastMsg.content) {
            preview = lastMsg.content.length > 100
              ? lastMsg.content.slice(0, 100) + '...'
              : lastMsg.content;
          } else if (lastMsg.type === 'media') {
            preview = 'Sent a photo';
          } else if (lastMsg.type === 'voice') {
            preview = 'Sent a voice message';
          } else if (lastMsg.type === 'shared_post') {
            preview = 'Shared a post';
          }
        }

        return {
          id: conv.id,
          type: conv.type,
          name: conv.name,
          avatar_url: conv.avatar_url,
          last_message_at: conv.last_message_at,
          last_message_preview: preview,
          last_message_sender: conv.type === 'group' ? lastMsg?.sender_display_name ?? null : null,
          unread_count: unreadCounts.get(conv.id) ?? 0,
          participants: otherParticipants,
        };
      });

      // Fetch pending message requests where user is recipient
      const messageRequests = await MessageRequest.findAll({
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
            include: [
              {
                model: Message,
                as: 'messages',
                limit: 1,
                order: [['created_at', 'DESC']],
                attributes: ['content', 'type', 'created_at'],
              },
            ],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      const formattedRequests = messageRequests.map((mr) => {
        const conv = (mr as unknown as { conversation?: { messages?: Array<{ content: string | null; type: string; created_at: Date }> } }).conversation;
        const lastMsg = conv?.messages?.[0] ?? null;
        return {
          id: mr.id,
          requester: (mr as unknown as { requester: unknown }).requester,
          conversation_id: mr.conversation_id,
          preview: lastMsg?.content
            ? lastMsg.content.length > 100
              ? lastMsg.content.slice(0, 100) + '...'
              : lastMsg.content
            : null,
          created_at: mr.created_at,
        };
      });

      return successResponse({
        conversations: formattedConversations,
        messageRequests: formattedRequests,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch conversations');
    }
  }
);

/**
 * POST /api/chat/conversations
 * Create a new direct or group conversation.
 * Enforces messaging access rules for direct conversations.
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const json = await req.json();
      const parsed = createConversationSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { type, participant_ids, name, avatar_url } = parsed.data;
      const userId = context.user.id;

      // Cannot include self in participant_ids
      const otherIds = participant_ids.filter((id) => id !== userId);
      if (otherIds.length === 0) {
        return errorResponse('Must include at least one other participant');
      }

      // Check block status
      const blockedIds = await getBlockedUserIds(userId);
      for (const pid of otherIds) {
        if (blockedIds.has(pid)) {
          return errorResponse('Cannot create conversation with blocked user', 403);
        }
      }

      // Validate all participants exist
      const existingUsers = await User.findAll({
        where: { id: { [Op.in]: otherIds }, deleted_at: null },
        attributes: ['id', 'is_admin'],
      });
      if (existingUsers.length !== otherIds.length) {
        return errorResponse('One or more participants not found', 404);
      }

      if (type === 'direct') {
        // Direct: exactly 1 other user
        if (otherIds.length !== 1) {
          return errorResponse('Direct conversations must have exactly 1 other participant');
        }

        const targetId = otherIds[0];

        // Check if direct conversation already exists
        const existing = await findExistingDirectConversation(userId, targetId);
        if (existing) {
          // Restore deleted_at if user had soft-deleted it
          await ConversationParticipant.update(
            { deleted_at: null },
            {
              where: {
                conversation_id: existing.id,
                user_id: userId,
                deleted_at: { [Op.ne]: null },
              },
            }
          );
          return successResponse(
            await getConversationDetail(existing.id, userId),
            200
          );
        }

        // Check messaging access rules
        const targetUser = existingUsers.find((u) => u.id === targetId)!;
        const currentUser = await User.findByPk(userId, { attributes: ['id', 'is_admin'] });
        const isAdminOrMod = currentUser?.is_admin || false;

        if (!isAdminOrMod) {
          const targetSettings = await UserSetting.findOne({
            where: { user_id: targetId },
            attributes: ['messaging_access'],
          });

          const access = targetSettings?.messaging_access ?? 'mutual';

          if (access === 'nobody') {
            return errorResponse('This user does not accept messages', 403);
          }

          if (access === 'followers') {
            // Target must follow requester
            const targetFollowsMe = await Follow.findOne({
              where: { follower_id: targetId, following_id: userId, status: 'active' },
              attributes: ['id'],
            });
            if (!targetFollowsMe) {
              // Create message request instead
              return await createMessageRequest(userId, targetId);
            }
          }

          if (access === 'mutual') {
            const targetFollowsMe = await Follow.findOne({
              where: { follower_id: targetId, following_id: userId, status: 'active' },
              attributes: ['id'],
            });
            const iFollowTarget = await Follow.findOne({
              where: { follower_id: userId, following_id: targetId, status: 'active' },
              attributes: ['id'],
            });
            if (!targetFollowsMe || !iFollowTarget) {
              return await createMessageRequest(userId, targetId);
            }
          }
        }

        // Create direct conversation
        const conversation = await sequelize.transaction(async (t) => {
          const conv = await Conversation.create(
            { type: 'direct', creator_id: userId },
            { transaction: t }
          );

          await ConversationParticipant.bulkCreate(
            [
              { conversation_id: conv.id, user_id: userId, role: 'admin' },
              { conversation_id: conv.id, user_id: targetId, role: 'member' },
            ],
            { transaction: t }
          );

          return conv;
        });

        return successResponse(
          await getConversationDetail(conversation.id, userId),
          201
        );
      }

      // Group conversation
      if (otherIds.length > 255) {
        return errorResponse('Group conversations can have at most 256 participants');
      }

      const conversation = await sequelize.transaction(async (t) => {
        const conv = await Conversation.create(
          {
            type: 'group',
            name: name || null,
            avatar_url: avatar_url || null,
            creator_id: userId,
          },
          { transaction: t }
        );

        const participantRows = [
          { conversation_id: conv.id, user_id: userId, role: 'admin' as const },
          ...otherIds.map((id) => ({
            conversation_id: conv.id,
            user_id: id,
            role: 'member' as const,
          })),
        ];

        await ConversationParticipant.bulkCreate(participantRows, { transaction: t });

        return conv;
      });

      return successResponse(
        await getConversationDetail(conversation.id, userId),
        201
      );
    } catch (error) {
      return serverError(error, 'Failed to create conversation');
    }
  }
);

// ---- Helper functions ----

/**
 * Find an existing direct conversation between two users.
 */
async function findExistingDirectConversation(
  userId: number,
  targetId: number
): Promise<Conversation | null> {
  // Find conversation IDs where userId is a participant
  const myConvIds = await ConversationParticipant.findAll({
    where: { user_id: userId },
    attributes: ['conversation_id'],
    raw: true,
  });

  if (myConvIds.length === 0) return null;

  const convIds = myConvIds.map((p) => p.conversation_id);

  // Find a direct conversation among those that also has targetId
  const targetParticipation = await ConversationParticipant.findOne({
    where: {
      conversation_id: { [Op.in]: convIds },
      user_id: targetId,
    },
    include: [
      {
        model: Conversation,
        as: 'conversation',
        where: { type: 'direct' },
      },
    ],
  });

  return targetParticipation
    ? (targetParticipation as unknown as { conversation: Conversation }).conversation
    : null;
}

/**
 * Create a MessageRequest when messaging access rules prevent direct conversation.
 */
async function createMessageRequest(requesterId: number, recipientId: number) {
  // Check for existing request
  const existing = await MessageRequest.findOne({
    where: { requester_id: requesterId, recipient_id: recipientId },
  });

  if (existing) {
    if (existing.status === 'declined') {
      return errorResponse('Message request was previously declined', 403);
    }
    if (existing.status === 'pending') {
      return successResponse(
        { message: 'Message request already pending', request: existing },
        202
      );
    }
    // accepted - should not happen, but just in case
  }

  // Create a conversation to hold the requested message
  const conv = await sequelize.transaction(async (t) => {
    const conversation = await Conversation.create(
      { type: 'direct', creator_id: requesterId },
      { transaction: t }
    );

    await ConversationParticipant.bulkCreate(
      [
        { conversation_id: conversation.id, user_id: requesterId, role: 'admin' },
        { conversation_id: conversation.id, user_id: recipientId, role: 'member' },
      ],
      { transaction: t }
    );

    await MessageRequest.create(
      {
        conversation_id: conversation.id,
        requester_id: requesterId,
        recipient_id: recipientId,
        status: 'pending',
      },
      { transaction: t }
    );

    return conversation;
  });

  return successResponse(
    { message: 'Message request sent', conversation_id: conv.id },
    202
  );
}

/**
 * Get conversation detail with participants for response.
 */
async function getConversationDetail(conversationId: number, userId: number) {
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

  return conversation;
}
