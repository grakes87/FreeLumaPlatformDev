import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { seedDefaultTemplates } from '@/lib/church-outreach/default-templates';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  html_body: z.string().min(1),
  merge_fields: z.array(z.string()).optional(),
});

/**
 * GET /api/admin/church-outreach/templates
 * List all templates ordered by is_default DESC, created_at ASC.
 * Seeds defaults on first access if no templates exist.
 */
export const GET = withAdmin(async (_req: NextRequest, _context: AuthContext) => {
  try {
    const { OutreachTemplate } = await import('@/lib/db/models');

    // Lazy seed: create defaults if no templates exist
    await seedDefaultTemplates();

    const templates = await OutreachTemplate.findAll({
      order: [
        ['is_default', 'DESC'],
        ['created_at', 'ASC'],
      ],
    });

    return successResponse({ templates });
  } catch (error) {
    return serverError(error, 'Failed to fetch templates');
  }
});

/**
 * POST /api/admin/church-outreach/templates
 * Create a custom template.
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { OutreachTemplate } = await import('@/lib/db/models');

    const template = await OutreachTemplate.create({
      name: parsed.data.name,
      subject: parsed.data.subject,
      html_body: parsed.data.html_body,
      merge_fields: parsed.data.merge_fields || null,
      is_default: false,
    });

    return successResponse({ template }, 201);
  } catch (error) {
    return serverError(error, 'Failed to create template');
  }
});
