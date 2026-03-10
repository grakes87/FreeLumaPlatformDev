import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subject: z.string().min(1).max(500).optional(),
  html_body: z.string().min(1).optional(),
  merge_fields: z.array(z.string()).nullable().optional(),
  template_assets: z.record(z.string(), z.string()).nullable().optional(),
});

/**
 * GET /api/admin/church-outreach/templates/[id]
 * Return a single template by ID.
 */
export const GET = withAdmin(async (_req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const templateId = parseInt(id, 10);
    if (isNaN(templateId)) return errorResponse('Invalid template ID');

    const { OutreachTemplate } = await import('@/lib/db/models');

    const template = await OutreachTemplate.findByPk(templateId);
    if (!template) return errorResponse('Template not found', 404);

    return successResponse({ template });
  } catch (error) {
    return serverError(error, 'Failed to fetch template');
  }
});

/**
 * PUT /api/admin/church-outreach/templates/[id]
 * Update template fields. Cannot change is_default flag.
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const templateId = parseInt(id, 10);
    if (isNaN(templateId)) return errorResponse('Invalid template ID');

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { OutreachTemplate } = await import('@/lib/db/models');

    const template = await OutreachTemplate.findByPk(templateId);
    if (!template) return errorResponse('Template not found', 404);

    // Update only provided fields (cannot change is_default)
    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.subject !== undefined) updates.subject = parsed.data.subject;
    if (parsed.data.html_body !== undefined) updates.html_body = parsed.data.html_body;
    if (parsed.data.merge_fields !== undefined) updates.merge_fields = parsed.data.merge_fields;
    if (parsed.data.template_assets !== undefined) updates.template_assets = parsed.data.template_assets;

    await template.update(updates);

    return successResponse({ template });
  } catch (error) {
    return serverError(error, 'Failed to update template');
  }
});

/**
 * DELETE /api/admin/church-outreach/templates/[id]
 * Delete a template. Returns 409 if referenced by a campaign or drip step.
 */
export const DELETE = withAdmin(async (_req: NextRequest, context: AuthContext) => {
  try {
    const { id } = await context.params;
    const templateId = parseInt(id, 10);
    if (isNaN(templateId)) return errorResponse('Invalid template ID');

    const { OutreachTemplate, OutreachCampaign, DripStep } = await import('@/lib/db/models');

    const template = await OutreachTemplate.findByPk(templateId);
    if (!template) return errorResponse('Template not found', 404);

    // Check if template is referenced by any campaign
    const campaignCount = await OutreachCampaign.count({ where: { template_id: templateId } });
    if (campaignCount > 0) {
      return errorResponse('Template is in use by one or more campaigns', 409);
    }

    // Check if template is referenced by any drip step
    const dripStepCount = await DripStep.count({ where: { template_id: templateId } });
    if (dripStepCount > 0) {
      return errorResponse('Template is in use by one or more drip sequence steps', 409);
    }

    await template.destroy();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serverError(error, 'Failed to delete template');
  }
});
