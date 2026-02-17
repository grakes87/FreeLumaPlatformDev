import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op, literal } from 'sequelize';

const createWorkshopSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(5000).optional(),
  category_id: z.number().int().positive().optional(),
  scheduled_at: z.string().datetime('Invalid date format'),
  duration_minutes: z.number().int().min(15).max(480).optional(),
  is_private: z.boolean().optional().default(false),
  max_capacity: z.number().int().min(2).max(500).optional(),
});

/**
 * GET /api/workshops - List workshops with filters and cursor pagination
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const {
        Workshop,
        WorkshopCategory,
        WorkshopAttendee,
        WorkshopInvite,
        User,
      } = await import('@/lib/db/models');

      const { searchParams } = new URL(req.url);
      const categoryId = searchParams.get('category');
      const statusFilter = searchParams.get('status');
      const hostId = searchParams.get('host');
      const seriesId = searchParams.get('series_id');
      const cursor = searchParams.get('cursor');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
      const past = searchParams.get('past') === 'true';
      const my = searchParams.get('my') === 'true';
      const userId = context.user.id;

      // Build WHERE clause
      const where: Record<string, unknown> = {};

      // Series filter: when filtering by series, show all statuses by default
      if (seriesId) {
        const sId = parseInt(seriesId, 10);
        if (!isNaN(sId)) {
          where.series_id = sId;
        }
      }

      if (past) {
        // Past workshops: ended, ordered by actual_ended_at DESC
        where.status = 'ended';
      } else if (statusFilter) {
        where.status = statusFilter;
      } else if (!seriesId) {
        // Default: upcoming scheduled, lobby, or live (skip when series filter shows all)
        where.status = { [Op.in]: ['scheduled', 'lobby', 'live'] };
        where.scheduled_at = { [Op.gte]: new Date() };
      }

      if (categoryId) {
        const catId = parseInt(categoryId, 10);
        if (!isNaN(catId)) {
          where.category_id = catId;
        }
      }

      if (hostId) {
        const hId = parseInt(hostId, 10);
        if (!isNaN(hId)) {
          where.host_id = hId;
        }
      }

      // Filter by user's mode so bible users don't see positivity workshops and vice versa
      const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
      if (currentUser?.mode) {
        where.mode = currentUser.mode;
      }

      // Handle cursor pagination
      if (cursor) {
        const cursorId = parseInt(cursor, 10);
        if (!isNaN(cursorId)) {
          if (past) {
            where.id = { [Op.lt]: cursorId };
          } else {
            where.id = { [Op.gt]: cursorId };
          }
        }
      }

      // If "my" workshops, find workshops where user is host or RSVP'd
      let myWorkshopIds: number[] | null = null;
      if (my) {
        // Get workshops where user is RSVP'd
        const attendances = await WorkshopAttendee.findAll({
          where: { user_id: userId },
          attributes: ['workshop_id'],
          raw: true,
        });
        const rsvpIds = attendances.map((a) => a.workshop_id);

        // Combine with host_id filter
        where[Op.or as unknown as string] = [
          { host_id: userId },
          ...(rsvpIds.length > 0 ? [{ id: { [Op.in]: rsvpIds } }] : []),
        ];
      }

      // Determine ordering
      const order: [string, string][] = past
        ? [['actual_ended_at', 'DESC'], ['id', 'DESC']]
        : [['scheduled_at', 'ASC'], ['id', 'ASC']];

      const workshops = await Workshop.findAll({
        where,
        attributes: [
          'id', 'title', 'description', 'scheduled_at', 'duration_minutes',
          'status', 'is_private', 'max_capacity', 'attendee_count',
          'agora_channel', 'host_id', 'category_id', 'series_id',
          'recording_url', 'actual_started_at', 'actual_ended_at',
          'created_at',
        ],
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
        order,
        limit: limit + 1,
      });

      // Filter out private workshops the user is not invited to / hosting
      const filtered: typeof workshops = [];
      for (const workshop of workshops) {
        if (workshop.is_private) {
          const isHost = workshop.host_id === userId;
          if (!isHost) {
            // Check if user is co-host
            const isCoHost = await WorkshopAttendee.findOne({
              where: { workshop_id: workshop.id, user_id: userId, is_co_host: true },
              attributes: ['id'],
            });
            if (!isCoHost) {
              // Check if user has an invite
              const hasInvite = await WorkshopInvite.findOne({
                where: { workshop_id: workshop.id, user_id: userId },
                attributes: ['id'],
              });
              if (!hasInvite) {
                // Check if user has RSVP'd (could have been invited then RSVP'd)
                const hasRsvp = await WorkshopAttendee.findOne({
                  where: { workshop_id: workshop.id, user_id: userId },
                  attributes: ['id'],
                });
                if (!hasRsvp) continue; // Skip private workshop
              }
            }
          }
        }
        filtered.push(workshop);
      }

      // Apply pagination after filtering
      const hasMore = filtered.length > limit;
      const results = hasMore ? filtered.slice(0, limit) : filtered;
      const nextCursor = hasMore && results.length > 0
        ? results[results.length - 1].id
        : null;

      // Batch-fetch user's RSVP status for all results
      const workshopIds = results.map((w) => w.id);
      const userRsvps = workshopIds.length > 0
        ? await WorkshopAttendee.findAll({
            where: { workshop_id: { [Op.in]: workshopIds }, user_id: userId },
            attributes: ['workshop_id', 'status', 'is_co_host', 'can_speak'],
            raw: true,
          })
        : [];
      const rsvpMap = new Map(userRsvps.map((r) => [r.workshop_id, r]));

      // Build response
      const workshopData = results.map((w) => {
        const json = w.toJSON();
        const rsvp = rsvpMap.get(w.id);
        return {
          ...json,
          user_rsvp: rsvp
            ? { status: rsvp.status, is_co_host: rsvp.is_co_host, can_speak: rsvp.can_speak }
            : null,
          is_host: w.host_id === userId,
        };
      });

      return successResponse({ workshops: workshopData, nextCursor });
    } catch (error) {
      return serverError(error, 'Failed to fetch workshops');
    }
  }
);

/**
 * POST /api/workshops - Create a new workshop (requires can_host=true)
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { Workshop, WorkshopCategory, User } = await import('@/lib/db/models');

      // Check user has hosting privileges
      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'can_host', 'status', 'mode'],
      });

      if (!user) {
        return errorResponse('User not found', 404);
      }

      if (!user.can_host) {
        return errorResponse('You do not have hosting privileges', 403);
      }

      if (user.status !== 'active') {
        return errorResponse('Account must be active to create workshops', 403);
      }

      // Parse and validate body
      const json = await req.json();
      const parsed = createWorkshopSchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const data = parsed.data;

      // Validate scheduled_at is at least 15 minutes from now
      const scheduledAt = new Date(data.scheduled_at);
      const minTime = new Date(Date.now() + 15 * 60 * 1000);
      if (scheduledAt < minTime) {
        return errorResponse('Workshop must be scheduled at least 15 minutes from now');
      }

      // Validate category_id exists if provided
      if (data.category_id) {
        const category = await WorkshopCategory.findByPk(data.category_id);
        if (!category) {
          return errorResponse('Workshop category not found', 400);
        }
      }

      // Create workshop
      const workshop = await Workshop.create({
        host_id: context.user.id,
        title: data.title,
        description: data.description ?? null,
        category_id: data.category_id ?? null,
        scheduled_at: scheduledAt,
        duration_minutes: data.duration_minutes ?? null,
        is_private: data.is_private ?? false,
        max_capacity: data.max_capacity ?? null,
        mode: user.mode || 'bible',
      });

      // Set agora_channel
      await workshop.update({ agora_channel: `workshop-${workshop.id}` });

      // Reload with associations
      const created = await Workshop.findByPk(workshop.id, {
        include: [
          {
            model: (await import('@/lib/db/models')).User,
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

      return successResponse({ workshop: created }, 201);
    } catch (error) {
      return serverError(error, 'Failed to create workshop');
    }
  }
);
