import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';
import { Op, fn, col, literal } from 'sequelize';

/**
 * GET /api/workshops/dashboard - Host dashboard analytics
 *
 * Returns stats, upcoming/recent workshops, attendance trend,
 * top workshops, and active series for the authenticated host.
 */
export const GET = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const {
        Workshop,
        WorkshopCategory,
        WorkshopSeries,
      } = await import('@/lib/db/models');

      const hostId = context.user.id;

      // --- Stats ---
      const endedWhere = { host_id: hostId, status: 'ended' as const };

      const [
        totalWorkshops,
        totalAttendeesResult,
        avgDurationResult,
        avgAttendanceResult,
        totalRecordings,
        upcomingCount,
      ] = await Promise.all([
        Workshop.count({ where: endedWhere }),
        Workshop.findOne({
          where: endedWhere,
          attributes: [[fn('SUM', col('attendee_count')), 'total']],
          raw: true,
        }),
        Workshop.findOne({
          where: {
            ...endedWhere,
            actual_started_at: { [Op.ne]: null },
            actual_ended_at: { [Op.ne]: null },
          },
          attributes: [
            [
              fn(
                'AVG',
                literal('TIMESTAMPDIFF(MINUTE, actual_started_at, actual_ended_at)')
              ),
              'avg_duration',
            ],
          ],
          raw: true,
        }),
        Workshop.findOne({
          where: endedWhere,
          attributes: [[fn('AVG', col('attendee_count')), 'avg']],
          raw: true,
        }),
        Workshop.count({
          where: { ...endedWhere, recording_url: { [Op.ne]: null } },
        }),
        Workshop.count({
          where: { host_id: hostId, status: 'scheduled' },
        }),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalAttendees = Number((totalAttendeesResult as any)?.total) || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const averageDuration = Math.round(Number((avgDurationResult as any)?.avg_duration) || 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const averageAttendance = Math.round(Number((avgAttendanceResult as any)?.avg) || 0);

      const stats = {
        totalWorkshops,
        totalAttendees,
        averageDuration,
        averageAttendance,
        totalRecordings,
        upcomingCount,
      };

      // --- Upcoming workshops (next 5 scheduled) ---
      const upcomingWorkshops = await Workshop.findAll({
        where: { host_id: hostId, status: 'scheduled' },
        attributes: [
          'id', 'title', 'scheduled_at', 'duration_minutes',
          'attendee_count', 'max_capacity', 'category_id',
        ],
        include: [
          {
            model: WorkshopCategory,
            as: 'category',
            attributes: ['id', 'name'],
          },
        ],
        order: [['scheduled_at', 'ASC']],
        limit: 5,
      });

      // --- Recent workshops (last 10 ended) ---
      const recentWorkshops = await Workshop.findAll({
        where: endedWhere,
        attributes: [
          'id', 'title', 'scheduled_at', 'actual_started_at',
          'actual_ended_at', 'attendee_count', 'recording_url',
          'category_id',
        ],
        include: [
          {
            model: WorkshopCategory,
            as: 'category',
            attributes: ['id', 'name'],
          },
        ],
        order: [['actual_ended_at', 'DESC']],
        limit: 10,
      });

      // --- Attendance trend (last 10 ended workshops) ---
      const trendWorkshops = await Workshop.findAll({
        where: endedWhere,
        attributes: ['id', 'title', 'scheduled_at', 'attendee_count'],
        order: [['scheduled_at', 'DESC']],
        limit: 10,
        raw: true,
      });

      // Reverse to show oldest-to-newest
      const attendanceTrend = trendWorkshops.reverse().map((w) => ({
        date: w.scheduled_at,
        title: w.title,
        attendees: w.attendee_count,
      }));

      // --- Top workshops (by attendee count, top 5) ---
      const topWorkshops = await Workshop.findAll({
        where: endedWhere,
        attributes: [
          'id', 'title', 'scheduled_at', 'attendee_count',
          'category_id',
        ],
        include: [
          {
            model: WorkshopCategory,
            as: 'category',
            attributes: ['id', 'name'],
          },
        ],
        order: [['attendee_count', 'DESC']],
        limit: 5,
      });

      // --- Active series ---
      const series = await WorkshopSeries.findAll({
        where: { host_id: hostId, is_active: true },
        attributes: [
          'id', 'title', 'rrule', 'time_of_day', 'timezone',
          'duration_minutes', 'category_id',
        ],
        include: [
          {
            model: WorkshopCategory,
            as: 'category',
            attributes: ['id', 'name'],
          },
          {
            model: Workshop,
            as: 'workshops',
            attributes: ['id', 'title', 'scheduled_at', 'status'],
            where: { status: 'scheduled' },
            required: false,
            limit: 1,
            order: [['scheduled_at', 'ASC']],
          },
        ],
      });

      return successResponse({
        stats,
        upcomingWorkshops,
        recentWorkshops,
        attendanceTrend,
        topWorkshops,
        series,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch dashboard data');
    }
  }
);
