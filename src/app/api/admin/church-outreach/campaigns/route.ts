import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  templateId: z.number().int().positive(),
  filterCriteria: z.object({
    stages: z.array(z.string()).optional(),
    states: z.array(z.string()).optional(),
    denominations: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * Build a Sequelize where clause from campaign filter criteria.
 */
function buildChurchFilter(filterCriteria: Record<string, unknown> | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    contact_email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
  };

  if (!filterCriteria) return where;

  const stages = filterCriteria.stages as string[] | undefined;
  const states = filterCriteria.states as string[] | undefined;
  const denominations = filterCriteria.denominations as string[] | undefined;

  if (stages && stages.length > 0) {
    where.pipeline_stage = { [Op.in]: stages };
  }
  if (states && states.length > 0) {
    where.state = { [Op.in]: states };
  }
  if (denominations && denominations.length > 0) {
    where.denomination = { [Op.in]: denominations };
  }

  return where;
}

/**
 * GET /api/admin/church-outreach/campaigns
 * List campaigns with cursor pagination. Includes template name.
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { OutreachCampaign, OutreachTemplate } = await import('@/lib/db/models');
    const url = new URL(req.url);

    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (cursor) {
      where.id = { [Op.lt]: parseInt(cursor, 10) };
    }

    const campaigns = await OutreachCampaign.findAll({
      where,
      include: [
        {
          model: OutreachTemplate,
          as: 'template',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = campaigns.length > limit;
    const paginated = campaigns.slice(0, limit);
    const nextCursor = hasMore && paginated.length > 0
      ? String(paginated[paginated.length - 1].id)
      : null;

    return successResponse({
      campaigns: paginated,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch campaigns');
  }
});

/**
 * POST /api/admin/church-outreach/campaigns
 * Create a draft campaign. Returns matching church count.
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { OutreachCampaign, OutreachTemplate, Church, OutreachUnsubscribe } = await import('@/lib/db/models');

    // Verify template exists
    const template = await OutreachTemplate.findByPk(parsed.data.templateId);
    if (!template) return errorResponse('Template not found', 404);

    const filterCriteria = parsed.data.filterCriteria || null;

    // Count matching churches (preview)
    const churchWhere = buildChurchFilter(filterCriteria as Record<string, unknown> | null);

    // Exclude unsubscribed emails
    const unsubEmails = await OutreachUnsubscribe.findAll({
      attributes: ['email'],
      raw: true,
    });
    const unsubSet = new Set(unsubEmails.map((u) => u.email));

    const allMatchingChurches = await Church.findAll({
      where: churchWhere,
      attributes: ['id', 'contact_email'],
      raw: true,
    });

    const eligibleCount = allMatchingChurches.filter(
      (c) => c.contact_email && !unsubSet.has(c.contact_email)
    ).length;

    const campaign = await OutreachCampaign.create({
      name: parsed.data.name,
      template_id: parsed.data.templateId,
      filter_criteria: filterCriteria,
      status: 'draft',
      created_by: context.user.id,
    });

    return successResponse({
      campaign,
      matching_church_count: eligibleCount,
    }, 201);
  } catch (error) {
    return serverError(error, 'Failed to create campaign');
  }
});

export { buildChurchFilter };
