import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/church-outreach/reports - Reporting dashboard aggregates
 *
 * Returns:
 * 1. Pipeline funnel (count per stage)
 * 2. Conversion metrics (total, rate, revenue)
 * 3. Email metrics (sent, opened, clicked, rates)
 * 4. Sample metrics (shipped, conversion rate)
 * 5. Activity timeline (last 30 days, count per day)
 * 6. Top engaged churches (by email opens/clicks, top 10)
 */
export const GET = withAdmin(async (_req: NextRequest, _context: AuthContext) => {
  try {
    const { sequelize } = await import('@/lib/db');
    const { QueryTypes } = await import('sequelize');

    // 1. Pipeline funnel: count of churches at each pipeline stage
    const pipelineFunnel = await sequelize.query<{ stage: string; count: number }>(
      `SELECT pipeline_stage AS stage, COUNT(*) AS count
       FROM churches
       GROUP BY pipeline_stage
       ORDER BY FIELD(pipeline_stage, 'new_lead', 'contacted', 'engaged', 'sample_requested', 'sample_sent', 'converted', 'lost')`,
      { type: QueryTypes.SELECT }
    );

    // 2. Conversion metrics
    const [conversionMetrics] = await sequelize.query<{
      total_churches: number;
      total_conversions: number;
      total_revenue: number | null;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM churches) AS total_churches,
         (SELECT COUNT(*) FROM church_conversions) AS total_conversions,
         (SELECT SUM(revenue_estimate) FROM church_conversions) AS total_revenue`,
      { type: QueryTypes.SELECT }
    );

    const totalChurches = Number(conversionMetrics.total_churches) || 0;
    const totalConversions = Number(conversionMetrics.total_conversions) || 0;
    const conversionRate = totalChurches > 0 ? totalConversions / totalChurches : 0;

    // 3. Email metrics
    const [emailMetrics] = await sequelize.query<{
      total_sent: number;
      total_opened: number;
      total_clicked: number;
    }>(
      `SELECT
         COUNT(*) AS total_sent,
         SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) AS total_opened,
         SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS total_clicked
       FROM outreach_emails
       WHERE status IN ('sent', 'opened', 'clicked')`,
      { type: QueryTypes.SELECT }
    );

    const totalSent = Number(emailMetrics.total_sent) || 0;
    const totalOpened = Number(emailMetrics.total_opened) || 0;
    const totalClicked = Number(emailMetrics.total_clicked) || 0;
    const openRate = totalSent > 0 ? totalOpened / totalSent : 0;
    const clickRate = totalSent > 0 ? totalClicked / totalSent : 0;

    // 4. Sample metrics
    const [sampleMetrics] = await sequelize.query<{
      total_shipped: number;
      churches_with_samples: number;
      churches_converted_after_sample: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM sample_shipments) AS total_shipped,
         (SELECT COUNT(DISTINCT church_id) FROM sample_shipments) AS churches_with_samples,
         (SELECT COUNT(*) FROM church_conversions cc
          INNER JOIN sample_shipments ss ON ss.church_id = cc.church_id) AS churches_converted_after_sample`,
      { type: QueryTypes.SELECT }
    );

    const totalShipped = Number(sampleMetrics.total_shipped) || 0;
    const churchesWithSamples = Number(sampleMetrics.churches_with_samples) || 0;
    const convertedAfterSample = Number(sampleMetrics.churches_converted_after_sample) || 0;
    const sampleConversionRate = churchesWithSamples > 0 ? convertedAfterSample / churchesWithSamples : 0;

    // 5. Activity timeline: last 30 days, count per day
    const activityTimeline = await sequelize.query<{ date: string; count: number }>(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM church_activities
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      { type: QueryTypes.SELECT }
    );

    // 6. Top engaged churches by email opens/clicks (top 10)
    const topEngaged = await sequelize.query<{
      church_id: number;
      church_name: string;
      opens: number;
      clicks: number;
      total_engagement: number;
    }>(
      `SELECT
         c.id AS church_id,
         c.name AS church_name,
         SUM(CASE WHEN oe.opened_at IS NOT NULL THEN 1 ELSE 0 END) AS opens,
         SUM(CASE WHEN oe.clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS clicks,
         SUM(CASE WHEN oe.opened_at IS NOT NULL THEN 1 ELSE 0 END) +
         SUM(CASE WHEN oe.clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS total_engagement
       FROM outreach_emails oe
       INNER JOIN churches c ON c.id = oe.church_id
       WHERE oe.status IN ('sent', 'opened', 'clicked')
       GROUP BY c.id, c.name
       HAVING total_engagement > 0
       ORDER BY total_engagement DESC
       LIMIT 10`,
      { type: QueryTypes.SELECT }
    );

    return successResponse({
      pipeline: pipelineFunnel,
      conversion: {
        total: totalConversions,
        rate: Math.round(conversionRate * 10000) / 100,
        totalRevenue: Number(conversionMetrics.total_revenue) || 0,
      },
      email: {
        totalSent,
        totalOpened,
        totalClicked,
        openRate: Math.round(openRate * 10000) / 100,
        clickRate: Math.round(clickRate * 10000) / 100,
      },
      samples: {
        totalShipped,
        churchesWithSamples,
        convertedAfterSample,
        sampleConversionRate: Math.round(sampleConversionRate * 10000) / 100,
      },
      activityTimeline,
      topEngaged,
    });
  } catch (error) {
    return serverError(error, 'Failed to generate reports');
  }
});
