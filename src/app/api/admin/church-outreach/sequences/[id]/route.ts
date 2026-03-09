import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const stepSchema = z.object({
  templateId: z.number().int().positive(),
  delayDays: z.number().int().min(0),
});

const updateSequenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullish(),
  trigger: z.enum(['manual', 'sample_shipped', 'stage_change']).optional(),
  is_active: z.boolean().optional(),
  steps: z.array(stepSchema).min(1).optional(),
});

/**
 * GET /api/admin/church-outreach/sequences/[id] - Get sequence detail with steps
 *
 * Returns the sequence with all steps (including template name) and active enrollment count.
 */
export const GET = withAdmin(async (_req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const sequenceId = parseInt(id, 10);
    if (isNaN(sequenceId)) return errorResponse('Invalid sequence ID');

    const { DripSequence, DripStep, DripEnrollment, OutreachTemplate } = await import('@/lib/db/models');
    const { literal } = await import('sequelize');

    const sequence = await DripSequence.findByPk(sequenceId, {
      attributes: {
        include: [
          [
            literal('(SELECT COUNT(*) FROM drip_enrollments WHERE drip_enrollments.sequence_id = DripSequence.id AND drip_enrollments.status = \'active\')'),
            'active_enrollment_count',
          ],
        ],
      },
    });

    if (!sequence) return errorResponse('Sequence not found', 404);

    const steps = await DripStep.findAll({
      where: { sequence_id: sequenceId },
      include: [
        {
          model: OutreachTemplate,
          as: 'template',
          attributes: ['id', 'name', 'subject'],
        },
      ],
      order: [['step_order', 'ASC']],
    });

    return successResponse({ sequence, steps });
  } catch (error) {
    return serverError(error, 'Failed to fetch drip sequence');
  }
});

/**
 * PUT /api/admin/church-outreach/sequences/[id] - Update a drip sequence
 *
 * Body: { name?, description?, trigger?, is_active?, steps?: [{ templateId, delayDays }] }
 * If steps provided, replaces all existing steps (delete + recreate in transaction).
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const sequenceId = parseInt(id, 10);
    if (isNaN(sequenceId)) return errorResponse('Invalid sequence ID');

    const body = await req.json();
    const parsed = updateSequenceSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues.map((e: { message: string }) => e.message).join(', '));
    }

    const { steps, ...sequenceFields } = parsed.data;
    const { DripSequence, DripStep } = await import('@/lib/db/models');
    const { sequelize } = await import('@/lib/db');

    const result = await sequelize.transaction(async (t) => {
      const sequence = await DripSequence.findByPk(sequenceId, { transaction: t });
      if (!sequence) return null;

      // Update sequence fields
      const updateData: Record<string, unknown> = {};
      if (sequenceFields.name !== undefined) updateData.name = sequenceFields.name;
      if (sequenceFields.description !== undefined) updateData.description = sequenceFields.description ?? null;
      if (sequenceFields.trigger !== undefined) updateData.trigger = sequenceFields.trigger;
      if (sequenceFields.is_active !== undefined) updateData.is_active = sequenceFields.is_active;

      if (Object.keys(updateData).length > 0) {
        await sequence.update(updateData, { transaction: t });
      }

      // Replace steps if provided
      let newSteps;
      if (steps) {
        await DripStep.destroy({ where: { sequence_id: sequenceId }, transaction: t });
        newSteps = await Promise.all(
          steps.map((step, index) =>
            DripStep.create(
              {
                sequence_id: sequenceId,
                step_order: index + 1,
                template_id: step.templateId,
                delay_days: step.delayDays,
              },
              { transaction: t }
            )
          )
        );
      } else {
        newSteps = await DripStep.findAll({
          where: { sequence_id: sequenceId },
          order: [['step_order', 'ASC']],
          transaction: t,
        });
      }

      return { sequence, steps: newSteps };
    });

    if (!result) return errorResponse('Sequence not found', 404);

    return successResponse(result);
  } catch (error) {
    return serverError(error, 'Failed to update drip sequence');
  }
});

/**
 * DELETE /api/admin/church-outreach/sequences/[id] - Delete a drip sequence
 *
 * Returns 409 if there are active enrollments. Otherwise cascade deletes steps + non-active enrollments.
 */
export const DELETE = withAdmin(async (_req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const sequenceId = parseInt(id, 10);
    if (isNaN(sequenceId)) return errorResponse('Invalid sequence ID');

    const { DripSequence, DripStep, DripEnrollment } = await import('@/lib/db/models');
    const { sequelize } = await import('@/lib/db');

    const sequence = await DripSequence.findByPk(sequenceId);
    if (!sequence) return errorResponse('Sequence not found', 404);

    // Check for active enrollments
    const activeCount = await DripEnrollment.count({
      where: { sequence_id: sequenceId, status: 'active' },
    });

    if (activeCount > 0) {
      return errorResponse(
        `Sequence has ${activeCount} active enrollment(s). Cancel or complete them before deleting.`,
        409
      );
    }

    await sequelize.transaction(async (t) => {
      // Delete steps
      await DripStep.destroy({ where: { sequence_id: sequenceId }, transaction: t });
      // Delete non-active enrollments (paused, completed, cancelled)
      await DripEnrollment.destroy({ where: { sequence_id: sequenceId }, transaction: t });
      // Delete sequence
      await sequence.destroy({ transaction: t });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serverError(error, 'Failed to delete drip sequence');
  }
});
