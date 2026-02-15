import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';

const updateWorkshopSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  category_id: z.number().int().positive().nullable().optional(),
  scheduled_at: z.string().datetime('Invalid date format').optional(),
  duration_minutes: z.number().int().min(15).max(480).nullable().optional(),
  is_private: z.boolean().optional(),
  max_capacity: z.number().int().min(2).max(500).nullable().optional(),
});

/**
 * GET /api/workshops/[id] - Get workshop detail with host info, RSVP status, and series info
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const {
        Workshop,
        WorkshopCategory,
        WorkshopSeries,
        WorkshopAttendee,
        WorkshopInvite,
        User,
      } = await import('@/lib/db/models');

      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (isNaN(workshopId)) {
        return errorResponse('Invalid workshop ID');
      }

      const userId = context.user.id;

      const workshop = await Workshop.findByPk(workshopId, {
        include: [
          {
            model: User,
            as: 'host',
            attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color', 'bio'],
          },
          {
            model: WorkshopCategory,
            as: 'category',
            attributes: ['id', 'name', 'slug'],
          },
          {
            model: WorkshopSeries,
            as: 'series',
            attributes: ['id', 'title', 'rrule'],
            required: false,
          },
        ],
      });

      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Access control for private workshops
      if (workshop.is_private) {
        const isHost = workshop.host_id === userId;
        if (!isHost) {
          const isCoHost = await WorkshopAttendee.findOne({
            where: { workshop_id: workshopId, user_id: userId, is_co_host: true },
            attributes: ['id'],
          });
          if (!isCoHost) {
            const hasInvite = await WorkshopInvite.findOne({
              where: { workshop_id: workshopId, user_id: userId },
              attributes: ['id'],
            });
            if (!hasInvite) {
              const hasRsvp = await WorkshopAttendee.findOne({
                where: { workshop_id: workshopId, user_id: userId },
                attributes: ['id'],
              });
              if (!hasRsvp) {
                return errorResponse('Workshop not found', 404);
              }
            }
          }
        }
      }

      // Get user's RSVP status
      const userRsvp = await WorkshopAttendee.findOne({
        where: { workshop_id: workshopId, user_id: userId },
        attributes: ['status', 'is_co_host', 'can_speak'],
      });

      const isHost = workshop.host_id === userId;

      // Find next workshop in series (if part of a series)
      let nextInSeries = null;
      if (workshop.series_id) {
        nextInSeries = await Workshop.findOne({
          where: {
            series_id: workshop.series_id,
            id: { [Op.ne]: workshopId },
            status: 'scheduled',
            scheduled_at: { [Op.gt]: new Date() },
          },
          attributes: ['id', 'title', 'scheduled_at'],
          order: [['scheduled_at', 'ASC']],
        });
      }

      const workshopJson = workshop.toJSON();

      return successResponse({
        workshop: {
          ...workshopJson,
          has_recording: !!workshop.recording_url,
          next_in_series: nextInSeries,
        },
        userRsvp: userRsvp
          ? {
              status: userRsvp.status,
              is_co_host: userRsvp.is_co_host,
              can_speak: userRsvp.can_speak,
            }
          : null,
        isHost,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch workshop');
    }
  }
);

/**
 * PUT /api/workshops/[id] - Update workshop details (host only, scheduled status only)
 */
export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const {
        Workshop,
        WorkshopCategory,
        WorkshopAttendee,
        User,
      } = await import('@/lib/db/models');

      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (isNaN(workshopId)) {
        return errorResponse('Invalid workshop ID');
      }

      const userId = context.user.id;

      const workshop = await Workshop.findByPk(workshopId);
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Only host can edit
      if (workshop.host_id !== userId) {
        return errorResponse('Only the host can edit this workshop', 403);
      }

      // Can only edit scheduled workshops
      if (workshop.status !== 'scheduled') {
        return errorResponse('Can only edit workshops with scheduled status', 400);
      }

      // Parse and validate body
      const json = await req.json();
      const parsed = updateWorkshopSchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const data = parsed.data;
      const updates: Record<string, unknown> = {};
      let scheduleChanged = false;

      if (data.title !== undefined) updates.title = data.title;
      if (data.description !== undefined) updates.description = data.description;
      if (data.is_private !== undefined) updates.is_private = data.is_private;
      if (data.max_capacity !== undefined) updates.max_capacity = data.max_capacity;
      if (data.duration_minutes !== undefined) updates.duration_minutes = data.duration_minutes;

      // Validate category_id if provided
      if (data.category_id !== undefined) {
        if (data.category_id !== null) {
          const category = await WorkshopCategory.findByPk(data.category_id);
          if (!category) {
            return errorResponse('Workshop category not found', 400);
          }
        }
        updates.category_id = data.category_id;
      }

      // Validate scheduled_at if changed
      if (data.scheduled_at !== undefined) {
        const scheduledAt = new Date(data.scheduled_at);
        const minTime = new Date(Date.now() + 15 * 60 * 1000);
        if (scheduledAt < minTime) {
          return errorResponse('Workshop must be scheduled at least 15 minutes from now');
        }
        updates.scheduled_at = scheduledAt;
        scheduleChanged = true;
      }

      await workshop.update(updates);

      // Reload with associations
      const updated = await Workshop.findByPk(workshopId, {
        include: [
          {
            model: User,
            as: 'host',
            attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
          },
          {
            model: WorkshopCategory,
            as: 'category',
            attributes: ['id', 'name', 'slug'],
          },
        ],
      });

      // Fire-and-forget: notify RSVP'd attendees if schedule changed
      if (scheduleChanged) {
        notifyAttendeesOfUpdate(workshopId, workshop.title, userId).catch(() => {});
      }

      return successResponse({ workshop: updated });
    } catch (error) {
      return serverError(error, 'Failed to update workshop');
    }
  }
);

/**
 * DELETE /api/workshops/[id] - Cancel a workshop (host only)
 */
export const DELETE = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { Workshop } = await import('@/lib/db/models');

      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (isNaN(workshopId)) {
        return errorResponse('Invalid workshop ID');
      }

      const userId = context.user.id;

      const workshop = await Workshop.findByPk(workshopId);
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Only host can cancel
      if (workshop.host_id !== userId) {
        return errorResponse('Only the host can cancel this workshop', 403);
      }

      // Can't cancel already ended or cancelled workshops
      if (workshop.status === 'ended' || workshop.status === 'cancelled') {
        return errorResponse(`Workshop is already ${workshop.status}`, 400);
      }

      // Set status to cancelled
      await workshop.update({ status: 'cancelled' });

      // Fire-and-forget: notify RSVP'd attendees of cancellation
      notifyAttendeesOfCancellation(workshopId, workshop.title, userId).catch(() => {});

      return successResponse({ cancelled: true });
    } catch (error) {
      return serverError(error, 'Failed to cancel workshop');
    }
  }
);

/**
 * Fire-and-forget: Send update notifications to all RSVP'd attendees
 */
async function notifyAttendeesOfUpdate(
  workshopId: number,
  workshopTitle: string,
  hostId: number
): Promise<void> {
  const { WorkshopAttendee } = await import('@/lib/db/models');
  const { createNotification } = await import('@/lib/notifications/create');
  const { NotificationType, NotificationEntityType } = await import('@/lib/notifications/types');

  const attendees = await WorkshopAttendee.findAll({
    where: { workshop_id: workshopId },
    attributes: ['user_id'],
    raw: true,
  });

  for (const attendee of attendees) {
    try {
      await createNotification({
        recipient_id: attendee.user_id,
        actor_id: hostId,
        type: NotificationType.WORKSHOP_UPDATED,
        entity_type: NotificationEntityType.WORKSHOP,
        entity_id: workshopId,
        preview_text: workshopTitle,
      });
    } catch {
      // Non-fatal: continue sending to other attendees
    }
  }
}

/**
 * Fire-and-forget: Send cancellation notifications to all RSVP'd attendees
 */
async function notifyAttendeesOfCancellation(
  workshopId: number,
  workshopTitle: string,
  hostId: number
): Promise<void> {
  const { WorkshopAttendee } = await import('@/lib/db/models');
  const { createNotification } = await import('@/lib/notifications/create');
  const { NotificationType, NotificationEntityType } = await import('@/lib/notifications/types');

  const attendees = await WorkshopAttendee.findAll({
    where: { workshop_id: workshopId },
    attributes: ['user_id'],
    raw: true,
  });

  for (const attendee of attendees) {
    try {
      await createNotification({
        recipient_id: attendee.user_id,
        actor_id: hostId,
        type: NotificationType.WORKSHOP_CANCELLED,
        entity_type: NotificationEntityType.WORKSHOP,
        entity_id: workshopId,
        preview_text: workshopTitle,
      });
    } catch {
      // Non-fatal: continue sending to other attendees
    }
  }
}
