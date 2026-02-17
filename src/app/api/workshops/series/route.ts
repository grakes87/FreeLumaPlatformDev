import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { literal } from 'sequelize';

// Validate HH:MM 24-hour format
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// Valid IANA timezone check (best-effort via Intl)
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const VALID_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

const createSeriesSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  description: z.string().max(5000).optional(),
  category_id: z.number().int().positive().optional(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  byDay: z
    .array(z.enum(VALID_DAYS))
    .optional(),
  count: z
    .number()
    .int()
    .min(1)
    .max(52, 'Maximum 52 instances allowed')
    .optional(),
  until: z.string().datetime().optional(),
  time_of_day: z
    .string()
    .regex(TIME_REGEX, 'Time must be in HH:MM 24-hour format'),
  timezone: z
    .string()
    .min(1)
    .refine(isValidTimezone, 'Invalid IANA timezone'),
  duration_minutes: z
    .number()
    .int()
    .min(15, 'Minimum duration is 15 minutes')
    .max(480, 'Maximum duration is 8 hours')
    .optional(),
  is_private: z.boolean().optional(),
});

/**
 * GET /api/workshops/series - List workshop series
 *
 * Query params:
 * - host: number (filter by host_id)
 */
export const GET = withAuth(
  async (req: NextRequest, _context: AuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const hostParam = searchParams.get('host');

      const { WorkshopSeries, WorkshopCategory, User, Workshop } =
        await import('@/lib/db/models');

      const where: Record<string, unknown> = { is_active: true };
      if (hostParam) {
        const hostId = parseInt(hostParam, 10);
        if (!isNaN(hostId)) {
          where.host_id = hostId;
        }
      }

      const series = await WorkshopSeries.findAll({
        where,
        include: [
          {
            model: WorkshopCategory,
            as: 'category',
            attributes: ['id', 'name', 'slug'],
            required: false,
          },
          {
            model: User,
            as: 'host',
            attributes: [
              'id',
              'display_name',
              'username',
              'avatar_url',
              'avatar_color',
            ],
          },
        ],
        attributes: {
          include: [
            // Workshop count subquery
            [
              literal(
                `(SELECT COUNT(*) FROM workshops WHERE workshops.series_id = \`WorkshopSeries\`.id AND workshops.status != 'cancelled')`
              ),
              'workshop_count',
            ],
            // Next scheduled instance subquery
            [
              literal(
                `(SELECT MIN(scheduled_at) FROM workshops WHERE workshops.series_id = \`WorkshopSeries\`.id AND workshops.status = 'scheduled' AND workshops.scheduled_at > NOW())`
              ),
              'next_scheduled_at',
            ],
          ],
        },
        order: [['created_at', 'DESC']],
      });

      return successResponse({ series });
    } catch (error) {
      return serverError(error, 'Failed to fetch workshop series');
    }
  }
);

/**
 * POST /api/workshops/series - Create a recurring workshop series
 *
 * Creates the series row and generates Workshop instances for a 90-day horizon.
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;

      const json = await req.json();
      const parsed = createSeriesSchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(
          parsed.error.issues[0]?.message || 'Invalid input'
        );
      }

      const {
        title,
        description,
        category_id,
        frequency,
        byDay,
        count,
        until,
        time_of_day,
        timezone,
        duration_minutes,
        is_private,
      } = parsed.data;

      const { User, WorkshopSeries, Workshop, WorkshopCategory } =
        await import('@/lib/db/models');
      const { buildRRuleString, generateInstancesInTimezone } =
        await import('@/lib/workshop/recurrence');

      // Check user has can_host flag
      const user = await User.findByPk(userId, {
        attributes: ['id', 'can_host', 'mode'],
      });
      if (!user || !user.can_host) {
        return errorResponse(
          'You do not have permission to host workshops',
          403
        );
      }

      // Validate category if provided
      if (category_id) {
        const category = await WorkshopCategory.findByPk(category_id, {
          attributes: ['id', 'is_active'],
        });
        if (!category || !category.is_active) {
          return errorResponse('Invalid or inactive category', 400);
        }
      }

      // Build RRULE string
      const rruleString = buildRRuleString(frequency, {
        byDay: byDay as string[] | undefined,
        count,
        until: until ? new Date(until) : undefined,
      });

      const userMode = user.mode || 'bible';

      // Create the series
      const series = await WorkshopSeries.create({
        host_id: userId,
        category_id: category_id ?? null,
        title,
        description: description ?? null,
        rrule: rruleString,
        time_of_day,
        timezone,
        duration_minutes: duration_minutes ?? null,
        mode: userMode,
      });

      // Generate instances for 90-day horizon
      const now = new Date();
      const instanceDates = generateInstancesInTimezone(
        rruleString,
        time_of_day,
        timezone,
        now,
        90
      );

      // Bulk create Workshop rows
      const workshopRows = instanceDates.map((scheduledAt) => ({
        series_id: series.id,
        host_id: userId,
        category_id: category_id ?? null,
        title,
        description: description ?? null,
        scheduled_at: scheduledAt,
        duration_minutes: duration_minutes ?? null,
        is_private: is_private ?? false,
        mode: userMode,
      }));

      const workshops = await Workshop.bulkCreate(workshopRows);

      // Set agora_channel after creation (needs workshop IDs)
      const updatePromises = workshops.map((w) =>
        w.update({ agora_channel: `workshop-${w.id}` })
      );
      await Promise.all(updatePromises);

      // Refresh to get updated data
      const createdWorkshops = await Workshop.findAll({
        where: { series_id: series.id },
        attributes: [
          'id',
          'title',
          'scheduled_at',
          'duration_minutes',
          'status',
          'agora_channel',
          'is_private',
        ],
        order: [['scheduled_at', 'ASC']],
      });

      return successResponse(
        {
          series: {
            id: series.id,
            host_id: series.host_id,
            title: series.title,
            description: series.description,
            rrule: series.rrule,
            time_of_day: series.time_of_day,
            timezone: series.timezone,
            duration_minutes: series.duration_minutes,
            category_id: series.category_id,
            created_at: series.created_at,
          },
          workshops: createdWorkshops,
        },
        201
      );
    } catch (error) {
      return serverError(error, 'Failed to create workshop series');
    }
  }
);
