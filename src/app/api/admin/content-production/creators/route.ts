import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const createCreatorSchema = z.object({
  user_id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  bio: z.string().max(2000).optional(),
  link_1: z.string().url().max(500).optional(),
  link_2: z.string().url().max(500).optional(),
  link_3: z.string().url().max(500).optional(),
  languages: z.array(z.string().min(1)).min(1),
  monthly_capacity: z.number().int().min(1).max(100),
  can_bible: z.boolean(),
  can_positivity: z.boolean(),
  is_ai: z.boolean(),
  heygen_avatar_id: z.string().max(255).optional(),
});

/**
 * GET /api/admin/content-production/creators
 * List all creators, optionally filtered by active status.
 *
 * Query params:
 *   active: 'true' | 'false' (optional, defaults to all)
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { LumaShortCreator, User } = await import('@/lib/db/models');
    const { searchParams } = new URL(req.url);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    const activeParam = searchParams.get('active');
    if (activeParam === 'true') {
      where.active = true;
    } else if (activeParam === 'false') {
      where.active = false;
    }

    const creators = await LumaShortCreator.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'avatar_url', 'avatar_color'],
        },
      ],
      order: [['name', 'ASC']],
    });

    return successResponse({ creators: creators.map((c) => c.toJSON()) });
  } catch (error) {
    return serverError(error, 'Failed to fetch creators');
  }
});

/**
 * POST /api/admin/content-production/creators
 * Create a new creator profile.
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { LumaShortCreator, User } = await import('@/lib/db/models');

    const json = await req.json();
    const parsed = createCreatorSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const data = parsed.data;

    // Verify user exists
    const user = await User.findByPk(data.user_id, { attributes: ['id'] });
    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Check no existing active creator for this user
    const existing = await LumaShortCreator.findOne({
      where: { user_id: data.user_id, active: true },
    });
    if (existing) {
      return errorResponse('User already has an active creator profile', 409);
    }

    const creator = await LumaShortCreator.create({
      user_id: data.user_id,
      name: data.name,
      bio: data.bio ?? null,
      link_1: data.link_1 ?? null,
      link_2: data.link_2 ?? null,
      link_3: data.link_3 ?? null,
      languages: data.languages,
      monthly_capacity: data.monthly_capacity,
      can_bible: data.can_bible,
      can_positivity: data.can_positivity,
      is_ai: data.is_ai,
      heygen_avatar_id: data.heygen_avatar_id ?? null,
    });

    return successResponse({ creator: creator.toJSON() }, 201);
  } catch (error) {
    return serverError(error, 'Failed to create creator');
  }
});
