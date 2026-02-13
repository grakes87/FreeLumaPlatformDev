import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Conversation,
  ConversationParticipant,
  Message,
  User,
  Follow,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { getBlockedUserIds } from '@/lib/utils/blocks';

const addParticipantSchema = z.object({
  user_id: z.number().int().positive(),
});

const removeParticipantSchema = z.object({
  user_id: z.number().int().positive(),
});

/**
 * POST /api/chat/conversations/[id]/participants
 * Add a participant to a group conversation.
 * Only conversation admin (creator) can add participants.
 * Max 256 participants.
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

      // Verify conversation exists and is a group
      const conversation = await Conversation.findByPk(conversationId, {
        attributes: ['id', 'type', 'creator_id'],
      });

      if (!conversation) {
        return errorResponse('Conversation not found', 404);
      }

      if (conversation.type !== 'group') {
        return errorResponse('Can only add participants to group conversations');
      }

      // Verify requester is admin
      const myParticipation = await ConversationParticipant.findOne({
        where: {
          conversation_id: conversationId,
          user_id: userId,
          deleted_at: null,
        },
      });

      if (!myParticipation) {
        return errorResponse('Conversation not found', 404);
      }

      if (myParticipation.role !== 'admin') {
        return errorResponse('Only group admins can add participants', 403);
      }

      const json = await req.json();
      const parsed = addParticipantSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { user_id: targetUserId } = parsed.data;

      // Check block status
      const blockedIds = await getBlockedUserIds(userId);
      if (blockedIds.has(targetUserId)) {
        return errorResponse('Cannot add blocked user', 403);
      }

      // Verify target user exists
      const targetUser = await User.findOne({
        where: { id: targetUserId, deleted_at: null },
        attributes: ['id', 'display_name'],
      });

      if (!targetUser) {
        return errorResponse('User not found', 404);
      }

      // Verify added user is in creator's followers
      const isFollower = await Follow.findOne({
        where: {
          follower_id: targetUserId,
          following_id: userId,
          status: 'active',
        },
        attributes: ['id'],
      });

      if (!isFollower) {
        return errorResponse('Can only add your own followers to the group', 403);
      }

      // Check max participants
      const currentCount = await ConversationParticipant.count({
        where: {
          conversation_id: conversationId,
          deleted_at: null,
        },
      });

      if (currentCount >= 256) {
        return errorResponse('Group is at maximum capacity (256 participants)');
      }

      // Check if already a participant (might have been removed/left)
      const existingParticipation = await ConversationParticipant.findOne({
        where: {
          conversation_id: conversationId,
          user_id: targetUserId,
        },
      });

      if (existingParticipation) {
        if (existingParticipation.deleted_at === null) {
          return errorResponse('User is already a participant');
        }
        // Restore if previously left/removed
        await existingParticipation.update({ deleted_at: null, role: 'member' });
      } else {
        await ConversationParticipant.create({
          conversation_id: conversationId,
          user_id: targetUserId,
          role: 'member',
        });
      }

      // Create system message
      const systemMsg = await Message.create({
        conversation_id: conversationId,
        sender_id: userId,
        type: 'system',
        content: `${targetUser.display_name} was added to the group`,
      });

      // Update conversation last_message
      await Conversation.update(
        { last_message_id: systemMsg.id, last_message_at: systemMsg.created_at },
        { where: { id: conversationId } }
      );

      // Emit Socket.IO event
      try {
        const { getIO } = await import('@/lib/socket/index');
        const io = getIO();
        const chatNsp = io.of('/chat');
        chatNsp.to(`conv:${conversationId}`).emit('participant:added', {
          conversation_id: conversationId,
          user_id: targetUserId,
        });
        // Emit the system message to the room
        chatNsp.to(`conv:${conversationId}`).emit('message:new', {
          id: systemMsg.id,
          conversation_id: conversationId,
          sender_id: userId,
          type: 'system',
          content: systemMsg.content,
          created_at: systemMsg.created_at,
        });
      } catch {
        // Socket.IO not available — skip silently
      }

      return successResponse({ message: 'Participant added' }, 201);
    } catch (error) {
      return serverError(error, 'Failed to add participant');
    }
  }
);

/**
 * DELETE /api/chat/conversations/[id]/participants
 * Remove a participant from a group conversation.
 * Admin can remove anyone. Members can only leave (remove themselves).
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

      // Verify conversation exists and is a group
      const conversation = await Conversation.findByPk(conversationId, {
        attributes: ['id', 'type'],
      });

      if (!conversation) {
        return errorResponse('Conversation not found', 404);
      }

      if (conversation.type !== 'group') {
        return errorResponse('Can only remove participants from group conversations');
      }

      // Verify requester is participant
      const myParticipation = await ConversationParticipant.findOne({
        where: {
          conversation_id: conversationId,
          user_id: userId,
          deleted_at: null,
        },
      });

      if (!myParticipation) {
        return errorResponse('Conversation not found', 404);
      }

      const json = await req.json();
      const parsed = removeParticipantSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { user_id: targetUserId } = parsed.data;

      // Members can only leave (remove themselves)
      if (myParticipation.role !== 'admin' && targetUserId !== userId) {
        return errorResponse('Only admins can remove other participants', 403);
      }

      const targetParticipation = await ConversationParticipant.findOne({
        where: {
          conversation_id: conversationId,
          user_id: targetUserId,
          deleted_at: null,
        },
      });

      if (!targetParticipation) {
        return errorResponse('Participant not found', 404);
      }

      // Get target user info for system message
      const targetUser = await User.findByPk(targetUserId, {
        attributes: ['id', 'display_name'],
      });

      // Soft delete the participant
      await targetParticipation.update({ deleted_at: new Date() });

      // Create system message
      const isLeaving = targetUserId === userId;
      const systemContent = isLeaving
        ? `${targetUser?.display_name || 'A member'} left the group`
        : `${targetUser?.display_name || 'A member'} was removed from the group`;

      const systemMsg = await Message.create({
        conversation_id: conversationId,
        sender_id: userId,
        type: 'system',
        content: systemContent,
      });

      // Update conversation last_message
      await Conversation.update(
        { last_message_id: systemMsg.id, last_message_at: systemMsg.created_at },
        { where: { id: conversationId } }
      );

      // Emit Socket.IO event
      try {
        const { getIO } = await import('@/lib/socket/index');
        const io = getIO();
        const chatNsp = io.of('/chat');
        chatNsp.to(`conv:${conversationId}`).emit('participant:removed', {
          conversation_id: conversationId,
          user_id: targetUserId,
        });
        chatNsp.to(`conv:${conversationId}`).emit('message:new', {
          id: systemMsg.id,
          conversation_id: conversationId,
          sender_id: userId,
          type: 'system',
          content: systemMsg.content,
          created_at: systemMsg.created_at,
        });
      } catch {
        // Socket.IO not available — skip silently
      }

      return successResponse({ message: 'Participant removed' });
    } catch (error) {
      return serverError(error, 'Failed to remove participant');
    }
  }
);
