import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/workshops - List all workshops with filters (admin only)
 *
 * Query params:
 *   status: filter by status (scheduled, lobby, live, ended, cancelled)
 *   host_id: filter by host user ID
 *   category_id: filter by category
 *   cursor: pagination cursor (workshop ID)
 *   limit: items per page (default 20, max 100)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { Workshop, WorkshopCategory, User } = await import('@/lib/db/models');
    const url = new URL(req.url);

    const status = url.searchParams.get('status');
    const hostId = url.searchParams.get('host_id');
    const categoryId = url.searchParams.get('category_id');
    const q = url.searchParams.get('q');
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (q && q.trim()) {
      where.title = { [Op.like]: `%${q.trim()}%` };
    }

    if (hostId) {
      const hId = parseInt(hostId, 10);
      if (!isNaN(hId)) where.host_id = hId;
    }

    if (categoryId) {
      const cId = parseInt(categoryId, 10);
      if (!isNaN(cId)) where.category_id = cId;
    }

    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (!isNaN(cursorId)) {
        where.id = { [Op.lt]: cursorId };
      }
    }

    const workshops = await Workshop.findAll({
      where,
      attributes: [
        'id', 'title', 'description', 'scheduled_at', 'duration_minutes',
        'status', 'is_private', 'max_capacity', 'attendee_count',
        'host_id', 'category_id', 'series_id',
        'recording_url', 'actual_started_at', 'actual_ended_at',
        'created_by_admin_id', 'created_at',
      ],
      include: [
        {
          model: User,
          as: 'host',
          attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color', 'can_host'],
        },
        {
          model: WorkshopCategory,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: User,
          as: 'createdByAdmin',
          attributes: ['id', 'display_name', 'username'],
          required: false,
        },
      ],
      order: [['id', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = workshops.length > limit;
    const results = workshops.slice(0, limit);

    const nextCursor =
      hasMore && results.length > 0
        ? String(results[results.length - 1].id)
        : null;

    return successResponse({
      workshops: results,
      nextCursor,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch workshops');
  }
});

const adminActionSchema = z.object({
  action: z.enum(['cancel_workshop', 'revoke_host', 'restore_host', 'create_on_behalf']),
  workshopId: z.number().int().positive().optional(),
  userId: z.number().int().positive().optional(),
  // Fields for create_on_behalf
  host_id: z.number().int().positive().optional(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional(),
  category_id: z.number().int().positive().nullable().optional(),
  scheduled_at: z.string().optional(),
  duration_minutes: z.number().int().min(15).max(480).optional(),
  is_private: z.boolean().optional(),
});

/**
 * PUT /api/admin/workshops - Admin actions on workshops
 *
 * Actions:
 *   cancel_workshop: Cancel a workshop (any status except ended)
 *   revoke_host: Revoke hosting privileges for a user
 *   restore_host: Restore hosting privileges for a user
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const json = await req.json();
    const parsed = adminActionSchema.safeParse(json);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { action, workshopId, userId } = parsed.data;

    if (action === 'cancel_workshop') {
      if (!workshopId) {
        return errorResponse('workshopId is required for cancel_workshop');
      }

      const { Workshop, WorkshopAttendee } = await import('@/lib/db/models');

      const workshop = await Workshop.findByPk(workshopId);
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      if (workshop.status === 'ended') {
        return errorResponse('Cannot cancel a workshop that has already ended');
      }

      if (workshop.status === 'cancelled') {
        return errorResponse('Workshop is already cancelled');
      }

      await workshop.update({ status: 'cancelled' });

      // Notify attendees of cancellation
      const attendees = await WorkshopAttendee.findAll({
        where: { workshop_id: workshopId },
        attributes: ['user_id'],
        raw: true,
      });

      if (attendees.length > 0) {
        try {
          const { createNotification } = await import('@/lib/notifications/create');
          const { NotificationType, NotificationEntityType } = await import('@/lib/notifications/types');

          await Promise.allSettled(
            attendees.map((a) =>
              createNotification({
                recipient_id: a.user_id,
                actor_id: context.user.id,
                type: NotificationType.WORKSHOP_CANCELLED,
                entity_type: NotificationEntityType.WORKSHOP,
                entity_id: workshopId,
                preview_text: `Workshop "${workshop.title}" has been cancelled by an admin`,
              })
            )
          );
        } catch {
          // Notification failure should not block the action
          console.error('[Admin] Failed to send cancellation notifications');
        }
      }

      return successResponse({ success: true, action: 'cancel_workshop', workshopId });
    }

    if (action === 'revoke_host' || action === 'restore_host') {
      if (!userId) {
        return errorResponse(`userId is required for ${action}`);
      }

      const { User } = await import('@/lib/db/models');

      const targetUser = await User.findByPk(userId, {
        attributes: ['id', 'can_host', 'display_name'],
      });

      if (!targetUser) {
        return errorResponse('User not found', 404);
      }

      const newValue = action === 'restore_host';
      await targetUser.update({ can_host: newValue });

      return successResponse({
        success: true,
        action,
        userId,
        can_host: newValue,
      });
    }

    if (action === 'create_on_behalf') {
      const { host_id, title, description, category_id, scheduled_at, duration_minutes, is_private } = parsed.data;

      if (!host_id || !title || !scheduled_at) {
        return errorResponse('host_id, title, and scheduled_at are required');
      }

      const { User, Workshop } = await import('@/lib/db/models');

      // Validate host exists and is active
      const hostUser = await User.findByPk(host_id, { attributes: ['id', 'can_host', 'status', 'display_name', 'username'] });
      if (!hostUser) return errorResponse('Host user not found', 404);
      if (hostUser.status !== 'active') return errorResponse('Host user is not active');

      // Auto-enable can_host if needed
      if (!hostUser.can_host) {
        await hostUser.update({ can_host: true });
      }

      // Create workshop on behalf of host
      const workshop = await Workshop.create({
        host_id,
        title,
        description: description || null,
        category_id: category_id || null,
        scheduled_at: new Date(scheduled_at),
        duration_minutes: duration_minutes || null,
        is_private: is_private || false,
        created_by_admin_id: context.user.id,
      });

      // Notify host (non-fatal)
      try {
        const { createNotification } = await import('@/lib/notifications/create');
        const { NotificationType, NotificationEntityType } = await import('@/lib/notifications/types');
        await createNotification({
          recipient_id: host_id,
          actor_id: context.user.id,
          type: NotificationType.WORKSHOP_UPDATED,
          entity_type: NotificationEntityType.WORKSHOP,
          entity_id: workshop.id,
          preview_text: `Admin created a workshop for you: ${title}`,
        });
      } catch {
        console.error('[Admin] Failed to send workshop creation notification');
      }

      return successResponse({ workshop, action: 'create_on_behalf' }, 201);
    }

    return errorResponse('Unknown action');
  } catch (error) {
    return serverError(error, 'Failed to execute admin action');
  }
});
