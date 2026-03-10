import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/church-outreach/review - List pending_review emails
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { OutreachEmail, Church, OutreachTemplate } = await import('@/lib/db/models');

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const { count, rows } = await OutreachEmail.findAndCountAll({
      where: { status: 'pending_review' },
      include: [
        { model: Church, as: 'church', attributes: ['id', 'name', 'city', 'state', 'denomination', 'pastor_name', 'contact_email', 'pipeline_stage', 'outreach_fit_score'] },
        { model: OutreachTemplate, as: 'template', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'ASC']],
      limit,
      offset,
    });

    return successResponse({
      emails: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch review queue');
  }
});

const batchSchema = z.object({
  action: z.enum(['approve_all', 'reject_all']),
  emailIds: z.array(z.number()).optional(),
  rejectionReason: z.string().max(500).optional(),
});

/**
 * PATCH /api/admin/church-outreach/review - Batch approve/reject
 */
export const PATCH = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const json = await req.json();
    const parsed = batchSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { action, emailIds, rejectionReason } = parsed.data;
    const { OutreachEmail, Church, ChurchActivity, DripEnrollment, DripStep } = await import('@/lib/db/models');
    const { sequelize } = await import('@/lib/db');
    const { Op } = await import('sequelize');
    const { sendOutreachEmail } = await import('@/lib/church-outreach/email-sender');

    const where: Record<string, unknown> = { status: 'pending_review' };
    if (emailIds && emailIds.length > 0) {
      where.id = { [Op.in]: emailIds };
    }

    const emails = await OutreachEmail.findAll({
      where,
      include: [{ model: Church, as: 'church' }],
    });

    if (emails.length === 0) {
      return successResponse({ processed: 0, message: 'No pending emails found' });
    }

    let processed = 0;

    for (const email of emails) {
      try {
        await sequelize.transaction(async (t) => {
          const church = (email as unknown as { church: InstanceType<typeof Church> }).church;

          if (action === 'approve_all') {
            // Send the email via SendGrid
            const htmlToSend = email.ai_html || email.rendered_html || '';
            await sendOutreachEmail({
              to: email.to_email,
              subject: email.subject,
              html: htmlToSend,
              emailId: email.id,
              trackingId: email.tracking_id,
              churchId: email.church_id,
            });

            await email.update({
              status: 'sent',
              sent_at: new Date(),
              reviewed_by: context.user.id,
              reviewed_at: new Date(),
            }, { transaction: t });

            // Advance pipeline from new_lead to contacted
            if (church && church.pipeline_stage === 'new_lead') {
              await church.update({ pipeline_stage: 'contacted' }, { transaction: t });
            }

            // Resume drip enrollment
            if (email.drip_enrollment_id) {
              await advanceEnrollment(email.drip_enrollment_id, t, DripEnrollment, DripStep);
            }

            await ChurchActivity.create({
              church_id: email.church_id,
              activity_type: 'email_approved',
              description: `Email approved and sent: "${email.subject}"`,
              admin_id: context.user.id,
              metadata: { outreach_email_id: email.id },
            }, { transaction: t });
          } else {
            // Reject
            await email.update({
              status: 'rejected',
              reviewed_by: context.user.id,
              reviewed_at: new Date(),
              rejection_reason: rejectionReason || null,
            }, { transaction: t });

            // Resume drip enrollment (skip this step, schedule next)
            if (email.drip_enrollment_id) {
              await advanceEnrollment(email.drip_enrollment_id, t, DripEnrollment, DripStep);
            }

            await ChurchActivity.create({
              church_id: email.church_id,
              activity_type: 'email_rejected',
              description: `Email rejected: "${email.subject}"${rejectionReason ? ` — ${rejectionReason}` : ''}`,
              admin_id: context.user.id,
              metadata: { outreach_email_id: email.id, rejection_reason: rejectionReason },
            }, { transaction: t });
          }

          processed++;
        });
      } catch (emailErr) {
        console.error(`[Review Queue] Error processing email ${email.id}:`, emailErr);
      }
    }

    return successResponse({ processed, total: emails.length, action });
  } catch (error) {
    return serverError(error, 'Failed to process batch review');
  }
});

/**
 * Advance a drip enrollment after review (approve or reject).
 * Increments current_step and schedules the next step, or completes the enrollment.
 */
async function advanceEnrollment(
  enrollmentId: number,
  t: import('sequelize').Transaction,
  DripEnrollment: typeof import('@/lib/db/models').DripEnrollment,
  DripStep: typeof import('@/lib/db/models').DripStep
): Promise<void> {
  const enrollment = await DripEnrollment.findByPk(enrollmentId, { transaction: t });
  if (!enrollment || enrollment.status !== 'active') return;

  const newCurrentStep = enrollment.current_step + 1;
  const nextStep = await DripStep.findOne({
    where: {
      sequence_id: enrollment.sequence_id,
      step_order: newCurrentStep + 1,
    },
    transaction: t,
  });

  if (nextStep) {
    const nextStepAt = new Date();
    nextStepAt.setDate(nextStepAt.getDate() + nextStep.delay_days);
    await enrollment.update(
      { current_step: newCurrentStep, next_step_at: nextStepAt },
      { transaction: t }
    );
  } else {
    await enrollment.update(
      { current_step: newCurrentStep, status: 'completed', completed_at: new Date(), next_step_at: null },
      { transaction: t }
    );
  }
}
