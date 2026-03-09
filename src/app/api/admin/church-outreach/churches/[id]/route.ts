import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/db/models/Church';

const updateChurchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
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
  pipeline_stage: z.enum(PIPELINE_STAGES as unknown as [string, ...string[]]).optional(),
  notes: z.string().nullish(),
  ai_summary: z.string().nullish(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

/**
 * GET /api/admin/church-outreach/churches/[id] - Get single church with latest activities
 */
export const GET = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Church, ChurchActivity } = await import('@/lib/db/models');
    const params = await context.params;
    const churchId = parseInt(params.id, 10);

    if (isNaN(churchId)) {
      return errorResponse('Invalid church ID', 400);
    }

    const church = await Church.findByPk(churchId);
    if (!church) {
      return errorResponse('Church not found', 404);
    }

    const activities = await ChurchActivity.findAll({
      where: { church_id: churchId },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    return successResponse({
      church: church.toJSON(),
      activities: activities.map((a) => a.toJSON()),
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch church');
  }
});

/**
 * PUT /api/admin/church-outreach/churches/[id] - Update church fields
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Church, ChurchActivity } = await import('@/lib/db/models');
    const params = await context.params;
    const churchId = parseInt(params.id, 10);

    if (isNaN(churchId)) {
      return errorResponse('Invalid church ID', 400);
    }

    const json = await req.json();
    const parsed = updateChurchSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const church = await Church.findByPk(churchId);
    if (!church) {
      return errorResponse('Church not found', 404);
    }

    const updates = parsed.data;
    const oldStage = church.pipeline_stage;

    // Cast needed: Zod enum widened to string, Sequelize expects PipelineStage literal
    await church.update(updates as Parameters<typeof church.update>[0]);

    // If pipeline_stage changed, create a stage_change activity
    if (updates.pipeline_stage && updates.pipeline_stage !== oldStage) {
      await ChurchActivity.create({
        church_id: churchId,
        activity_type: 'stage_change',
        description: `Pipeline stage changed from ${oldStage} to ${updates.pipeline_stage}`,
        metadata: {
          old_stage: oldStage,
          new_stage: updates.pipeline_stage as PipelineStage,
        },
        admin_id: context.user.id,
      });
    }

    return successResponse({ church: church.toJSON() });
  } catch (error) {
    return serverError(error, 'Failed to update church');
  }
});

/**
 * DELETE /api/admin/church-outreach/churches/[id] - Hard delete a church
 */
export const DELETE = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Church } = await import('@/lib/db/models');
    const params = await context.params;
    const churchId = parseInt(params.id, 10);

    if (isNaN(churchId)) {
      return errorResponse('Invalid church ID', 400);
    }

    const church = await Church.findByPk(churchId);
    if (!church) {
      return errorResponse('Church not found', 404);
    }

    // Hard delete - cascades to activities, emails, enrollments, shipments, conversions
    await church.destroy();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serverError(error, 'Failed to delete church');
  }
});
