import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const createChurchSchema = z.object({
  name: z.string().min(1).max(255),
  pastor_name: z.string().max(255).nullish(),
  staff_names: z.array(z.string()).nullish(),
  denomination: z.string().max(100).nullish(),
  congregation_size_estimate: z.string().max(50).nullish(),
  youth_programs: z.array(z.string()).nullish(),
  service_times: z.array(z.string()).nullish(),
  website_url: z.string().url().max(500).nullish(),
  social_media: z.record(z.string(), z.string()).nullish(),
  contact_email: z.string().email().max(255).nullish(),
  contact_phone: z.string().max(50).nullish(),
  address_line1: z.string().max(255).nullish(),
  address_line2: z.string().max(255).nullish(),
  city: z.string().max(100).nullish(),
  state: z.string().max(50).nullish(),
  zip_code: z.string().max(20).nullish(),
  country: z.string().max(50).optional(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  notes: z.string().nullish(),
  ai_summary: z.string().nullish(),
});

/**
 * GET /api/admin/church-outreach/churches - List churches with filtering and pagination
 *
 * Query params:
 *   cursor: pagination cursor (church ID)
 *   limit: items per page (default 20, max 100)
 *   stage: filter by pipeline_stage
 *   state: filter by state (address)
 *   search: free-text search on name, city, pastor_name
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { Church } = await import('@/lib/db/models');
    const url = new URL(req.url);

    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const stage = url.searchParams.get('stage');
    const state = url.searchParams.get('state');
    const search = url.searchParams.get('search');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (stage) {
      where.pipeline_stage = stage;
    }

    if (state) {
      where.state = state;
    }

    if (search) {
      const searchTerm = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: searchTerm } },
        { city: { [Op.like]: searchTerm } },
        { pastor_name: { [Op.like]: searchTerm } },
      ];
    }

    if (cursor) {
      where.id = { ...(where.id || {}), [Op.lt]: parseInt(cursor, 10) };
    }

    const churches = await Church.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = churches.length > limit;
    const paginated = churches.slice(0, limit);

    const nextCursor = hasMore && paginated.length > 0
      ? String(paginated[paginated.length - 1].id)
      : null;

    // Get total count for the current filter
    const total = await Church.count({ where: stage || state || search ? where : undefined });

    return successResponse({
      churches: paginated.map((c) => c.toJSON()),
      next_cursor: nextCursor,
      has_more: hasMore,
      total,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch churches');
  }
});

/**
 * POST /api/admin/church-outreach/churches - Create a new church manually
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Church, ChurchActivity } = await import('@/lib/db/models');
    const json = await req.json();

    const parsed = createChurchSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const data = parsed.data;

    const church = await Church.create({
      ...data,
      source: 'manual',
      pipeline_stage: 'new_lead',
    });

    await ChurchActivity.create({
      church_id: church.id,
      activity_type: 'created',
      description: 'Church created manually',
      admin_id: context.user.id,
    });

    return successResponse({ church: church.toJSON() }, 201);
  } catch (error) {
    return serverError(error, 'Failed to create church');
  }
});
