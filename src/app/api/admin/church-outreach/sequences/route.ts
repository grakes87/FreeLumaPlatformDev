import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const stepSchema = z.object({
  templateId: z.number().int().positive(),
  delayDays: z.number().int().min(0),
});

const createSequenceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullish(),
  trigger: z.enum(['manual', 'sample_shipped', 'stage_change']).optional().default('manual'),
  steps: z.array(stepSchema).min(1, 'At least one step is required'),
});

/**
 * GET /api/admin/church-outreach/sequences - List all drip sequences
 *
 * Returns sequences with step count and enrollment count, ordered by created_at DESC.
 */
export const GET = withAdmin(async (_req: NextRequest, _context: AuthContext) => {
  try {
    const { DripSequence } = await import('@/lib/db/models');
    const { literal } = await import('sequelize');

    const sequences = await DripSequence.findAll({
      attributes: {
        include: [
          [
            literal('(SELECT COUNT(*) FROM drip_steps WHERE drip_steps.sequence_id = DripSequence.id)'),
            'step_count',
          ],
          [
            literal('(SELECT COUNT(*) FROM drip_enrollments WHERE drip_enrollments.sequence_id = DripSequence.id)'),
            'enrollment_count',
          ],
          [
            literal('(SELECT COUNT(*) FROM drip_enrollments WHERE drip_enrollments.sequence_id = DripSequence.id AND drip_enrollments.status = \'active\')'),
            'active_enrollment_count',
          ],
        ],
      },
      order: [['created_at', 'DESC']],
    });

    return successResponse({ sequences });
  } catch (error) {
    return serverError(error, 'Failed to fetch drip sequences');
  }
});

/**
 * POST /api/admin/church-outreach/sequences - Create a new drip sequence
 *
 * Body: { name, description?, trigger?, steps: [{ templateId, delayDays }] }
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = createSequenceSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues.map((e: { message: string }) => e.message).join(', '));
    }

    const { name, description, trigger, steps } = parsed.data;
    const { DripSequence, DripStep } = await import('@/lib/db/models');
    const { sequelize } = await import('@/lib/db');

    const result = await sequelize.transaction(async (t) => {
      const sequence = await DripSequence.create(
        {
          name,
          description: description ?? null,
          trigger: trigger!,
        },
        { transaction: t }
      );

      const stepRecords = await Promise.all(
        steps.map((step, index) =>
          DripStep.create(
            {
              sequence_id: sequence.id,
              step_order: index + 1,
              template_id: step.templateId,
              delay_days: step.delayDays,
            },
            { transaction: t }
          )
        )
      );

      return { sequence, steps: stepRecords };
    });

    return successResponse(result, 201);
  } catch (error) {
    return serverError(error, 'Failed to create drip sequence');
  }
});
