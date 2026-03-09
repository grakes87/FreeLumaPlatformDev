import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/db/models/Church';

const pipelineUpdateSchema = z.object({
  churchId: z.number().int().positive(),
  stage: z.enum(PIPELINE_STAGES as unknown as [string, ...string[]]),
});

/**
 * PUT /api/admin/church-outreach/pipeline - Update a church's pipeline stage
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Church, ChurchActivity } = await import('@/lib/db/models');
    const json = await req.json();

    const parsed = pipelineUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { churchId, stage } = parsed.data;

    const church = await Church.findByPk(churchId);
    if (!church) {
      return errorResponse('Church not found', 404);
    }

    const oldStage = church.pipeline_stage;

    if (oldStage === stage) {
      return successResponse({ church: church.toJSON(), message: 'No change' });
    }

    await church.update({ pipeline_stage: stage as PipelineStage });

    await ChurchActivity.create({
      church_id: churchId,
      activity_type: 'stage_change',
      description: `Pipeline stage changed from ${oldStage} to ${stage}`,
      metadata: {
        old_stage: oldStage,
        new_stage: stage,
      },
      admin_id: context.user.id,
    });

    return successResponse({ church: church.toJSON() });
  } catch (error) {
    return serverError(error, 'Failed to update pipeline stage');
  }
});
