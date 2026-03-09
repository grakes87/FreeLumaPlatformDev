import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { renderTemplate, renderSubject } from '@/lib/church-outreach/template-renderer';
import { sendOutreachEmail } from '@/lib/church-outreach/email-sender';

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  filterCriteria: z.object({
    stages: z.array(z.string()).optional(),
    states: z.array(z.string()).optional(),
    denominations: z.array(z.string()).optional(),
  }).optional(),
});

const actionSchema = z.object({
  action: z.enum(['send', 'cancel']),
});

/**
 * GET /api/admin/church-outreach/campaigns/[id]
 * Return campaign with stats and email list.
 */
export const GET = withAdmin(async (_req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) return errorResponse('Invalid campaign ID');

    const { OutreachCampaign, OutreachTemplate, OutreachEmail } = await import('@/lib/db/models');

    const campaign = await OutreachCampaign.findByPk(campaignId, {
      include: [
        {
          model: OutreachTemplate,
          as: 'template',
          attributes: ['id', 'name', 'subject'],
        },
      ],
    });

    if (!campaign) return errorResponse('Campaign not found', 404);

    // Get all emails for this campaign
    const emails = await OutreachEmail.findAll({
      where: { campaign_id: campaignId },
      order: [['created_at', 'ASC']],
      attributes: ['id', 'church_id', 'to_email', 'subject', 'status', 'tracking_id', 'sent_at', 'opened_at', 'clicked_at', 'created_at'],
    });

    return successResponse({
      campaign,
      emails,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch campaign');
  }
});

/**
 * PUT /api/admin/church-outreach/campaigns/[id]
 * Update campaign (name, filterCriteria). Only if status='draft'.
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) return errorResponse('Invalid campaign ID');

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { OutreachCampaign } = await import('@/lib/db/models');

    const campaign = await OutreachCampaign.findByPk(campaignId);
    if (!campaign) return errorResponse('Campaign not found', 404);

    if (campaign.status !== 'draft') {
      return errorResponse('Can only update draft campaigns', 409);
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.filterCriteria !== undefined) updates.filter_criteria = parsed.data.filterCriteria;

    await campaign.update(updates);

    return successResponse({ campaign });
  } catch (error) {
    return serverError(error, 'Failed to update campaign');
  }
});

/**
 * POST /api/admin/church-outreach/campaigns/[id]
 * Perform an action on a campaign: send or cancel.
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) return errorResponse('Invalid campaign ID');

    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { OutreachCampaign, OutreachTemplate, Church, OutreachEmail, OutreachUnsubscribe } = await import('@/lib/db/models');

    const campaign = await OutreachCampaign.findByPk(campaignId);
    if (!campaign) return errorResponse('Campaign not found', 404);

    // Handle cancel action
    if (parsed.data.action === 'cancel') {
      if (campaign.status !== 'draft' && campaign.status !== 'sending') {
        return errorResponse('Can only cancel draft or sending campaigns', 409);
      }
      await campaign.update({ status: 'cancelled' });
      return successResponse({ campaign });
    }

    // Handle send action
    if (campaign.status !== 'draft') {
      return errorResponse('Can only send draft campaigns', 409);
    }

    // Get template
    const template = await OutreachTemplate.findByPk(campaign.template_id);
    if (!template) return errorResponse('Campaign template not found', 404);

    // Mark as sending
    await campaign.update({ status: 'sending' });

    // Build church filter from campaign criteria
    const filterCriteria = campaign.filter_criteria as Record<string, unknown> | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const churchWhere: any = {
      contact_email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
    };

    if (filterCriteria) {
      const stages = filterCriteria.stages as string[] | undefined;
      const states = filterCriteria.states as string[] | undefined;
      const denominations = filterCriteria.denominations as string[] | undefined;

      if (stages && stages.length > 0) {
        churchWhere.pipeline_stage = { [Op.in]: stages };
      }
      if (states && states.length > 0) {
        churchWhere.state = { [Op.in]: states };
      }
      if (denominations && denominations.length > 0) {
        churchWhere.denomination = { [Op.in]: denominations };
      }
    }

    // Get all matching churches
    const churches = await Church.findAll({ where: churchWhere });

    // Get unsubscribed emails
    const unsubEmails = await OutreachUnsubscribe.findAll({
      attributes: ['email'],
      raw: true,
    });
    const unsubSet = new Set(unsubEmails.map((u) => u.email));

    // Filter out unsubscribed churches
    const eligibleChurches = churches.filter(
      (c) => c.contact_email && !unsubSet.has(c.contact_email)
    );

    let sentCount = 0;

    // Process each church
    for (const church of eligibleChurches) {
      const trackingId = uuidv4();
      const renderedSubject = renderSubject(template.subject, church);
      const renderedHtml = renderTemplate(template.html_body, church);

      // Create email record
      const emailRecord = await OutreachEmail.create({
        church_id: church.id,
        campaign_id: campaign.id,
        template_id: template.id,
        to_email: church.contact_email!,
        subject: renderedSubject,
        status: 'queued',
        tracking_id: trackingId,
      });

      try {
        // Send email
        await sendOutreachEmail({
          to: church.contact_email!,
          subject: renderedSubject,
          html: renderedHtml,
          emailId: emailRecord.id,
          trackingId,
          churchId: church.id,
        });

        // Mark as sent
        await emailRecord.update({
          status: 'sent',
          sent_at: new Date(),
        });
        sentCount++;
      } catch (error) {
        // Mark as bounced on error, continue to next church
        console.error(`[Campaign ${campaign.id}] Failed to send to ${church.contact_email}:`, error);
        await emailRecord.update({ status: 'bounced' });
      }
    }

    // Mark campaign as sent
    await campaign.update({
      status: 'sent',
      sent_at: new Date(),
      sent_count: sentCount,
    });

    return successResponse({ campaign });
  } catch (error) {
    return serverError(error, 'Failed to process campaign action');
  }
});
