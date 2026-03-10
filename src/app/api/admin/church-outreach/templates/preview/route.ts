import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { renderTemplate, renderSubject } from '@/lib/church-outreach/template-renderer';

const previewSchema = z.object({
  templateId: z.number().int().positive(),
  churchId: z.number().int().positive(),
});

/**
 * POST /api/admin/church-outreach/templates/preview
 * Render a template with a specific church's data for preview.
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { OutreachTemplate, Church } = await import('@/lib/db/models');

    const template = await OutreachTemplate.findByPk(parsed.data.templateId);
    if (!template) return errorResponse('Template not found', 404);

    const church = await Church.findByPk(parsed.data.churchId);
    if (!church) return errorResponse('Church not found', 404);

    const renderedSubject = renderSubject(template.subject, church);
    const renderedHtml = renderTemplate(template.html_body, church, template.template_assets);

    return successResponse({
      subject: renderedSubject,
      html: renderedHtml,
    });
  } catch (error) {
    return serverError(error, 'Failed to preview template');
  }
});
