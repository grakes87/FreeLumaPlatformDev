import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { createNotification } from '@/lib/notifications/create';
import { NotificationType, NotificationEntityType } from '@/lib/notifications/types';

const moderationActionSchema = z.object({
  action: z.enum(['remove_content', 'warn_user', 'ban_user', 'dismiss_report']),
  content_type: z.enum(['post', 'comment']),
  reason: z.string().min(1).max(2000),
  ban_duration: z.enum(['24h', '7d', '30d', 'permanent']).optional(),
});

/**
 * PUT /api/admin/moderation/[id] - Take moderation action on a report group
 *
 * The [id] param is the content_id. Body must include content_type to identify
 * which reports to act on.
 *
 * Actions:
 *   remove_content - Soft-delete content, notify author, log, mark reports reviewed
 *   warn_user - Send warning notification, log, mark reviewed
 *   ban_user - Create ban, set user.status='banned', notify, log, mark reviewed
 *   dismiss_report - Mark reports dismissed, log
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Report, Post, PostComment, User, Ban, ModerationLog, sequelize } = await import('@/lib/db/models');

    const params = await context.params;
    const contentId = parseInt(params.id, 10);
    if (isNaN(contentId)) {
      return errorResponse('Invalid content ID', 400);
    }

    const json = await req.json();
    const parsed = moderationActionSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { action, content_type: contentType, reason, ban_duration } = parsed.data;
    const adminId = context.user.id;

    // Validate ban_duration for ban_user action
    if (action === 'ban_user' && !ban_duration) {
      return errorResponse('ban_duration is required for ban_user action', 400);
    }

    // Find all pending reports for this content
    const reportWhere: Record<string, unknown> = {
      content_type: contentType,
      status: 'pending',
    };
    if (contentType === 'post') {
      reportWhere.post_id = contentId;
    } else {
      reportWhere.comment_id = contentId;
    }

    const reports = await Report.findAll({ where: reportWhere });
    if (reports.length === 0) {
      return errorResponse('No pending reports found for this content', 404);
    }

    // Determine the content author
    let authorId: number | null = null;
    if (contentType === 'post') {
      const post = await Post.findByPk(contentId, { paranoid: false, attributes: ['id', 'user_id'] });
      if (post) authorId = post.user_id;
    } else {
      const comment = await PostComment.findByPk(contentId, { attributes: ['id', 'user_id'] });
      if (comment) authorId = comment.user_id;
    }

    const transaction = await sequelize.transaction();

    try {
      const newStatus = action === 'dismiss_report' ? 'dismissed' : 'reviewed';

      switch (action) {
        case 'remove_content': {
          // Soft-delete the content
          if (contentType === 'post') {
            await Post.destroy({ where: { id: contentId }, transaction });
          } else {
            await PostComment.destroy({ where: { id: contentId }, transaction });
          }

          // Mark all reports
          await Report.update(
            {
              status: newStatus,
              reviewed_by: adminId,
              reviewed_at: new Date(),
              admin_notes: reason,
            },
            { where: reportWhere, transaction }
          );

          // Log action
          await ModerationLog.create(
            {
              admin_id: adminId,
              action: 'remove_content',
              target_user_id: authorId,
              target_content_type: contentType,
              target_content_id: contentId,
              reason,
            },
            { transaction }
          );

          await transaction.commit();

          // Notify author (non-fatal)
          if (authorId) {
            try {
              await createNotification({
                recipient_id: authorId,
                actor_id: adminId,
                type: NotificationType.CONTENT_REMOVED,
                entity_type: contentType === 'post' ? NotificationEntityType.POST : NotificationEntityType.COMMENT,
                entity_id: contentId,
                preview_text: `Your ${contentType} was removed for: ${reason}`,
              });
            } catch { /* non-fatal */ }
          }

          return successResponse({ success: true, action: 'remove_content', reports_updated: reports.length });
        }

        case 'warn_user': {
          if (!authorId) {
            await transaction.rollback();
            return errorResponse('Content author not found', 404);
          }

          // Mark reports
          await Report.update(
            {
              status: newStatus,
              reviewed_by: adminId,
              reviewed_at: new Date(),
              admin_notes: reason,
            },
            { where: reportWhere, transaction }
          );

          // Log action
          await ModerationLog.create(
            {
              admin_id: adminId,
              action: 'warn_user',
              target_user_id: authorId,
              target_content_type: contentType,
              target_content_id: contentId,
              reason,
            },
            { transaction }
          );

          await transaction.commit();

          // Notify user (non-fatal)
          try {
            await createNotification({
              recipient_id: authorId,
              actor_id: adminId,
              type: NotificationType.WARNING,
              entity_type: contentType === 'post' ? NotificationEntityType.POST : NotificationEntityType.COMMENT,
              entity_id: contentId,
              preview_text: `Warning: ${reason}`,
            });
          } catch { /* non-fatal */ }

          return successResponse({ success: true, action: 'warn_user', reports_updated: reports.length });
        }

        case 'ban_user': {
          if (!authorId) {
            await transaction.rollback();
            return errorResponse('Content author not found', 404);
          }

          // Calculate expires_at
          let expiresAt: Date | null = null;
          if (ban_duration !== 'permanent') {
            expiresAt = new Date();
            switch (ban_duration) {
              case '24h':
                expiresAt.setHours(expiresAt.getHours() + 24);
                break;
              case '7d':
                expiresAt.setDate(expiresAt.getDate() + 7);
                break;
              case '30d':
                expiresAt.setDate(expiresAt.getDate() + 30);
                break;
            }
          }

          // Create ban record
          await Ban.create(
            {
              user_id: authorId,
              banned_by: adminId,
              reason,
              duration: ban_duration!,
              expires_at: expiresAt,
            },
            { transaction }
          );

          // Update user status
          await User.update(
            { status: 'banned' },
            { where: { id: authorId }, transaction }
          );

          // Mark reports
          await Report.update(
            {
              status: newStatus,
              reviewed_by: adminId,
              reviewed_at: new Date(),
              admin_notes: reason,
            },
            { where: reportWhere, transaction }
          );

          // Log action
          await ModerationLog.create(
            {
              admin_id: adminId,
              action: 'ban_user',
              target_user_id: authorId,
              target_content_type: contentType,
              target_content_id: contentId,
              reason,
              metadata: JSON.stringify({ duration: ban_duration, expires_at: expiresAt }),
            },
            { transaction }
          );

          await transaction.commit();

          // Notify user (non-fatal)
          try {
            const durationText = ban_duration === 'permanent' ? 'permanently' : `for ${ban_duration}`;
            await createNotification({
              recipient_id: authorId,
              actor_id: adminId,
              type: NotificationType.BAN,
              entity_type: contentType === 'post' ? NotificationEntityType.POST : NotificationEntityType.COMMENT,
              entity_id: contentId,
              preview_text: `You have been banned ${durationText}: ${reason}`,
            });
          } catch { /* non-fatal */ }

          return successResponse({ success: true, action: 'ban_user', reports_updated: reports.length });
        }

        case 'dismiss_report': {
          // Mark reports as dismissed
          await Report.update(
            {
              status: newStatus,
              reviewed_by: adminId,
              reviewed_at: new Date(),
              admin_notes: reason,
            },
            { where: reportWhere, transaction }
          );

          // Log action
          await ModerationLog.create(
            {
              admin_id: adminId,
              action: 'dismiss_report',
              target_user_id: authorId,
              target_content_type: contentType,
              target_content_id: contentId,
              reason,
            },
            { transaction }
          );

          await transaction.commit();

          return successResponse({ success: true, action: 'dismiss_report', reports_updated: reports.length });
        }

        default:
          await transaction.rollback();
          return errorResponse('Invalid action', 400);
      }
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    return serverError(error, 'Failed to process moderation action');
  }
});
