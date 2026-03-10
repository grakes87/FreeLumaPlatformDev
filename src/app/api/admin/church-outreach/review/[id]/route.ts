import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/church-outreach/review/[id] - Single email detail
 */
export const GET = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const id = parseInt(req.url.split('/review/')[1]?.split('?')[0] || '');
    if (isNaN(id)) return errorResponse('Invalid email ID', 400);

    const { OutreachEmail, Church, OutreachTemplate, DripEnrollment, DripSequence } = await import('@/lib/db/models');

    const email = await OutreachEmail.findByPk(id, {
      include: [
        { model: Church, as: 'church' },
        { model: OutreachTemplate, as: 'template', attributes: ['id', 'name', 'subject'] },
        {
          model: DripEnrollment, as: 'enrollment',
          include: [{ model: DripSequence, as: 'sequence', attributes: ['id', 'name'] }],
        },
      ],
    });

    if (!email) return errorResponse('Email not found', 404);

    return successResponse({ email });
  } catch (error) {
    return serverError(error, 'Failed to fetch email details');
  }
});

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'edit_approve']),
  subject: z.string().max(500).optional(),
  html: z.string().optional(),
  rejectionReason: z.string().max(500).optional(),
});

/**
 * PATCH /api/admin/church-outreach/review/[id] - Approve, reject, or edit+approve
 */
export const PATCH = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const id = parseInt(req.url.split('/review/')[1]?.split('?')[0] || '');
    if (isNaN(id)) return errorResponse('Invalid email ID', 400);

    const json = await req.json();
    const parsed = reviewSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { action, subject, html, rejectionReason } = parsed.data;
    const { OutreachEmail, Church, ChurchActivity, DripEnrollment, DripStep } = await import('@/lib/db/models');
    const { sequelize } = await import('@/lib/db');

    const email = await OutreachEmail.findByPk(id, {
      include: [{ model: Church, as: 'church' }],
    });

    if (!email) return errorResponse('Email not found', 404);
    if (email.status !== 'pending_review') {
      return errorResponse(`Email is not pending review (current status: ${email.status})`, 400);
    }

    const church = (email as unknown as { church: InstanceType<typeof Church> }).church;

    await sequelize.transaction(async (t) => {
      if (action === 'approve' || action === 'edit_approve') {
        // For edit_approve, use the admin-edited content
        const finalSubject = action === 'edit_approve' && subject ? subject : email.subject;
        const finalHtml = action === 'edit_approve' && html ? html : (email.ai_html || email.rendered_html || '');

        // Update email with final content before sending
        if (action === 'edit_approve') {
          await email.update({
            subject: finalSubject,
            ai_html: finalHtml,
          }, { transaction: t });
        }

        // Send via SendGrid
        const { sendOutreachEmail } = await import('@/lib/church-outreach/email-sender');
        await sendOutreachEmail({
          to: email.to_email,
          subject: finalSubject,
          html: finalHtml,
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

        // Advance pipeline stage
        if (church && church.pipeline_stage === 'new_lead') {
          await church.update({ pipeline_stage: 'contacted' }, { transaction: t });
        }

        // Advance drip enrollment
        if (email.drip_enrollment_id) {
          const enrollment = await DripEnrollment.findByPk(email.drip_enrollment_id, { transaction: t });
          if (enrollment && enrollment.status === 'active') {
            const newStep = enrollment.current_step + 1;
            const nextStep = await DripStep.findOne({
              where: { sequence_id: enrollment.sequence_id, step_order: newStep + 1 },
              transaction: t,
            });

            if (nextStep) {
              const nextStepAt = new Date();
              nextStepAt.setDate(nextStepAt.getDate() + nextStep.delay_days);
              await enrollment.update({ current_step: newStep, next_step_at: nextStepAt }, { transaction: t });
            } else {
              await enrollment.update({
                current_step: newStep, status: 'completed', completed_at: new Date(), next_step_at: null,
              }, { transaction: t });
            }
          }
        }

        await ChurchActivity.create({
          church_id: email.church_id,
          activity_type: 'email_approved',
          description: `Email approved${action === 'edit_approve' ? ' (edited)' : ''} and sent: "${finalSubject}"`,
          admin_id: context.user.id,
          metadata: { outreach_email_id: email.id, edited: action === 'edit_approve' },
        }, { transaction: t });

      } else {
        // Reject
        await email.update({
          status: 'rejected',
          reviewed_by: context.user.id,
          reviewed_at: new Date(),
          rejection_reason: rejectionReason || null,
        }, { transaction: t });

        // Resume drip enrollment (skip step, schedule next)
        if (email.drip_enrollment_id) {
          const enrollment = await DripEnrollment.findByPk(email.drip_enrollment_id, { transaction: t });
          if (enrollment && enrollment.status === 'active') {
            const newStep = enrollment.current_step + 1;
            const nextStep = await DripStep.findOne({
              where: { sequence_id: enrollment.sequence_id, step_order: newStep + 1 },
              transaction: t,
            });

            if (nextStep) {
              const nextStepAt = new Date();
              nextStepAt.setDate(nextStepAt.getDate() + nextStep.delay_days);
              await enrollment.update({ current_step: newStep, next_step_at: nextStepAt }, { transaction: t });
            } else {
              await enrollment.update({
                current_step: newStep, status: 'completed', completed_at: new Date(), next_step_at: null,
              }, { transaction: t });
            }
          }
        }

        await ChurchActivity.create({
          church_id: email.church_id,
          activity_type: 'email_rejected',
          description: `Email rejected: "${email.subject}"${rejectionReason ? ` — ${rejectionReason}` : ''}`,
          admin_id: context.user.id,
          metadata: { outreach_email_id: email.id, rejection_reason: rejectionReason },
        }, { transaction: t });
      }
    });

    return successResponse({ success: true, action, emailId: id });
  } catch (error) {
    return serverError(error, 'Failed to process email review');
  }
});
