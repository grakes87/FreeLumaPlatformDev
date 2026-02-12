import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { rateLimit } from '@/lib/utils/rate-limit';

export async function GET(req: NextRequest) {
  try {
    // Rate limit: 10 per minute per IP to prevent enumeration
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const rateLimitResult = rateLimit(`check-username:${ip}`, 10, 60 * 1000);
    if (!rateLimitResult.success) {
      return errorResponse('Too many requests. Please try again later.', 429);
    }

    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return errorResponse('Username query parameter is required');
    }

    // Validate username format
    if (!/^[a-z0-9_]+$/.test(username) || username.length < 3 || username.length > 30) {
      return successResponse({ available: false, reason: 'Invalid username format' });
    }

    const { User } = await import('@/lib/db/models');
    const { fn, col, where: seqWhere } = await import('sequelize');

    // Case-insensitive check
    const existingUser = await User.findOne({
      where: seqWhere(fn('LOWER', col('username')), username.toLowerCase()),
    });

    return successResponse({ available: !existingUser });
  } catch (error) {
    return serverError(error, 'Failed to check username availability');
  }
}
