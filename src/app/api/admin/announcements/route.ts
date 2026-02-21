import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/announcements - List all announcements with dismissal counts
 */
export const GET = withAdmin(async (_req: NextRequest, _context: AuthContext) => {
  try {
    const { Announcement } = await import('@/lib/db/models');
    const { literal } = await import('sequelize');

    const announcements = await Announcement.findAll({
      attributes: {
        include: [
          [
            literal('(SELECT COUNT(*) FROM announcement_dismissals WHERE announcement_dismissals.announcement_id = Announcement.id)'),
            'dismissal_count',
          ],
        ],
      },
      order: [['created_at', 'DESC']],
    });

    return successResponse({ announcements });
  } catch (error) {
    return serverError(error, 'Failed to fetch announcements');
  }
});

const postSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  link_url: z.string().max(500).nullable().optional(),
  link_label: z.string().max(100).nullable().optional(),
  media_url: z.string().max(500).nullable().optional(),
  media_type: z.enum(['image', 'video']).nullable().optional(),
  target_mode: z.enum(['all', 'bible', 'positivity']).optional(),
  priority: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});

/**
 * POST /api/admin/announcements - Create a new announcement
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { Announcement } = await import('@/lib/db/models');

    const announcement = await Announcement.create({
      title: parsed.data.title,
      body: parsed.data.body,
      link_url: parsed.data.link_url ?? null,
      link_label: parsed.data.link_label ?? null,
      media_url: parsed.data.media_url ?? null,
      media_type: parsed.data.media_type ?? null,
      target_mode: parsed.data.target_mode ?? 'all',
      priority: parsed.data.priority ?? 0,
      active: parsed.data.active ?? true,
      starts_at: parsed.data.starts_at ? new Date(parsed.data.starts_at) : null,
      expires_at: parsed.data.expires_at ? new Date(parsed.data.expires_at) : null,
      created_by: context.user.id,
    });

    return successResponse({ announcement }, 201);
  } catch (error) {
    return serverError(error, 'Failed to create announcement');
  }
});

const putSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
  link_url: z.string().max(500).nullable().optional(),
  link_label: z.string().max(100).nullable().optional(),
  media_url: z.string().max(500).nullable().optional(),
  media_type: z.enum(['image', 'video']).nullable().optional(),
  target_mode: z.enum(['all', 'bible', 'positivity']).optional(),
  priority: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});

/**
 * PUT /api/admin/announcements - Update an announcement
 */
export const PUT = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = putSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { id, starts_at, expires_at, ...updateData } = parsed.data;

    const { Announcement } = await import('@/lib/db/models');

    const announcement = await Announcement.findByPk(id);
    if (!announcement) {
      return errorResponse('Announcement not found', 404);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { ...updateData };
    if (starts_at !== undefined) {
      updates.starts_at = starts_at ? new Date(starts_at) : null;
    }
    if (expires_at !== undefined) {
      updates.expires_at = expires_at ? new Date(expires_at) : null;
    }

    await announcement.update(updates);

    return successResponse({ announcement });
  } catch (error) {
    return serverError(error, 'Failed to update announcement');
  }
});

/**
 * DELETE /api/admin/announcements - Delete an announcement by ID
 */
export const DELETE = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id') || '', 10);

    if (!id || isNaN(id)) {
      return errorResponse('Missing or invalid announcement ID');
    }

    const { Announcement } = await import('@/lib/db/models');

    const announcement = await Announcement.findByPk(id);
    if (!announcement) {
      return errorResponse('Announcement not found', 404);
    }

    await announcement.destroy();

    return successResponse({ deleted: true });
  } catch (error) {
    return serverError(error, 'Failed to delete announcement');
  }
});
