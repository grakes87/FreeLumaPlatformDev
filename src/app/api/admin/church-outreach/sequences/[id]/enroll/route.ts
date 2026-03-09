import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const enrollSchema = z.object({
  churchId: z.number().int().positive().optional(),
  churchIds: z.array(z.number().int().positive()).optional(),
}).refine(
  (data) => data.churchId !== undefined || (data.churchIds !== undefined && data.churchIds.length > 0),
  { message: 'Either churchId or churchIds is required' }
);

const updateEnrollmentSchema = z.object({
  enrollmentId: z.number().int().positive(),
  action: z.enum(['pause', 'resume', 'cancel']),
});

/**
 * POST /api/admin/church-outreach/sequences/[id]/enroll - Enroll churches in a drip sequence
 *
 * Body: { churchId: number } OR { churchIds: number[] }
 * Returns: { enrolled: number, skipped: number }
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const sequenceId = parseInt(id, 10);
    if (isNaN(sequenceId)) return errorResponse('Invalid sequence ID');

    const body = await req.json();
    const parsed = enrollSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues.map((e: { message: string }) => e.message).join(', '));
    }

    const { DripSequence, DripStep, DripEnrollment, Church, OutreachUnsubscribe } = await import('@/lib/db/models');
    const { Op } = await import('sequelize');

    // Verify sequence exists and is active
    const sequence = await DripSequence.findByPk(sequenceId);
    if (!sequence) return errorResponse('Sequence not found', 404);
    if (!sequence.is_active) return errorResponse('Sequence is not active', 400);

    // Get first step for delay calculation
    const firstStep = await DripStep.findOne({
      where: { sequence_id: sequenceId },
      order: [['step_order', 'ASC']],
    });
    if (!firstStep) return errorResponse('Sequence has no steps', 400);

    // Normalize to array of church IDs
    const churchIds = parsed.data.churchIds ?? [parsed.data.churchId!];

    let enrolled = 0;
    let skipped = 0;

    for (const churchId of churchIds) {
      // Check if church exists
      const church = await Church.findByPk(churchId, { attributes: ['id', 'contact_email'] });
      if (!church) {
        skipped++;
        continue;
      }

      // Check if already enrolled (active or paused)
      const existingEnrollment = await DripEnrollment.findOne({
        where: {
          church_id: churchId,
          sequence_id: sequenceId,
          status: { [Op.in]: ['active', 'paused'] },
        },
      });
      if (existingEnrollment) {
        skipped++;
        continue;
      }

      // Check if church email is unsubscribed
      if (church.contact_email) {
        const unsubscribed = await OutreachUnsubscribe.findOne({
          where: { email: church.contact_email.toLowerCase() },
        });
        if (unsubscribed) {
          skipped++;
          continue;
        }
      }

      // Calculate next_step_at
      const nextStepAt = new Date();
      nextStepAt.setDate(nextStepAt.getDate() + firstStep.delay_days);

      // Create enrollment
      await DripEnrollment.create({
        church_id: churchId,
        sequence_id: sequenceId,
        current_step: 0,
        status: 'active',
        next_step_at: nextStepAt,
        enrolled_at: new Date(),
      });

      enrolled++;
    }

    return successResponse({ enrolled, skipped });
  } catch (error) {
    return serverError(error, 'Failed to enroll churches');
  }
});

/**
 * PUT /api/admin/church-outreach/sequences/[id]/enroll - Update enrollment status
 *
 * Body: { enrollmentId: number, action: 'pause' | 'resume' | 'cancel' }
 * Returns updated enrollment.
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const sequenceId = parseInt(id, 10);
    if (isNaN(sequenceId)) return errorResponse('Invalid sequence ID');

    const body = await req.json();
    const parsed = updateEnrollmentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues.map((e: { message: string }) => e.message).join(', '));
    }

    const { enrollmentId, action } = parsed.data;
    const { DripEnrollment, DripStep } = await import('@/lib/db/models');

    const enrollment = await DripEnrollment.findOne({
      where: { id: enrollmentId, sequence_id: sequenceId },
    });

    if (!enrollment) return errorResponse('Enrollment not found', 404);

    switch (action) {
      case 'pause': {
        if (enrollment.status !== 'active') {
          return errorResponse('Can only pause active enrollments');
        }
        await enrollment.update({ status: 'paused', next_step_at: null });
        break;
      }

      case 'resume': {
        if (enrollment.status !== 'paused') {
          return errorResponse('Can only resume paused enrollments');
        }

        // Recalculate next_step_at based on current_step
        const nextStep = await DripStep.findOne({
          where: {
            sequence_id: sequenceId,
            step_order: enrollment.current_step + 1,
          },
        });

        if (!nextStep) {
          // No more steps -- mark as completed
          await enrollment.update({
            status: 'completed',
            completed_at: new Date(),
          });
        } else {
          const nextStepAt = new Date();
          nextStepAt.setDate(nextStepAt.getDate() + nextStep.delay_days);
          await enrollment.update({
            status: 'active',
            next_step_at: nextStepAt,
          });
        }
        break;
      }

      case 'cancel': {
        if (enrollment.status === 'completed' || enrollment.status === 'cancelled') {
          return errorResponse(`Cannot cancel an enrollment that is already ${enrollment.status}`);
        }
        await enrollment.update({
          status: 'cancelled',
          next_step_at: null,
        });
        break;
      }
    }

    // Reload to return fresh data
    await enrollment.reload();
    return successResponse({ enrollment });
  } catch (error) {
    return serverError(error, 'Failed to update enrollment');
  }
});
