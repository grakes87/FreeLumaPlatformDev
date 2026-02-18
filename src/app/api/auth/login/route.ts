import { NextRequest } from 'next/server';
import { User, Ban, LumaShortCreator } from '@/lib/db/models';
import { loginSchema } from '@/lib/utils/validation';
import { comparePassword } from '@/lib/auth/password';
import { signJWT, AUTH_COOKIE_OPTIONS } from '@/lib/auth/jwt';
import { loginRateLimit } from '@/lib/utils/rate-limit';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return errorResponse(firstError?.message || 'Invalid input', 400);
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limiting per email
    const rateLimitResult = loginRateLimit(normalizedEmail);
    if (!rateLimitResult.success) {
      return errorResponse(
        'Too many login attempts. Please try again in 15 minutes.',
        429
      );
    }

    // Find user (exclude soft-deleted)
    const user = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return errorResponse('Account temporarily locked. Please try again later.', 429);
    }

    // Check password
    if (!user.password_hash) {
      return errorResponse('Invalid email or password', 401);
    }

    const passwordMatch = await comparePassword(password, user.password_hash);

    if (!passwordMatch) {
      // Increment failed attempts
      const newAttempts = user.failed_login_attempts + 1;
      const updateData: Record<string, unknown> = {
        failed_login_attempts: newAttempts,
      };

      // Lock account after threshold
      if (newAttempts >= LOCK_THRESHOLD) {
        updateData.locked_until = new Date(Date.now() + LOCK_DURATION_MS);
      }

      await user.update(updateData);

      return errorResponse('Invalid email or password', 401);
    }

    // --- Account status check (after password verified) ---
    if (user.status === 'banned') {
      // Check for an active ban
      const activeBan = await Ban.findOne({
        where: { user_id: user.id, lifted_at: null },
        order: [['created_at', 'DESC']],
      });

      if (activeBan && (activeBan.expires_at === null || new Date(activeBan.expires_at) > new Date())) {
        // Active ban still in effect
        return errorResponse('Account suspended', 403);
      }

      // Ban expired or no active ban found — auto-unban
      if (activeBan) {
        await activeBan.update({ lifted_at: new Date() });
      }
      await user.update({ status: 'active' });
    } else if (user.status === 'deactivated') {
      // Allow login but keep deactivated — user must explicitly reactivate
    } else if (user.status === 'pending_deletion') {
      // Cancel deletion on login
      await user.update({
        status: 'active',
        deletion_requested_at: null,
      });
    }

    // Successful login: reset failed attempts, update last login
    await user.update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date(),
    });

    // Sign JWT
    const token = await signJWT({ id: user.id, email: user.email });

    // Check if user is an active creator
    const creatorProfile = await LumaShortCreator.findOne({
      where: { user_id: user.id, active: true },
      attributes: ['id'],
    });

    // Build response (include token for Socket.IO auth fallback)
    const response = successResponse({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        username: user.username,
        avatar_url: user.avatar_url,
        avatar_color: user.avatar_color,
        bio: user.bio,
        mode: user.mode,
        email_verified: user.email_verified,
        is_admin: user.is_admin,
        is_creator: !!creatorProfile,
        onboarding_complete: user.onboarding_complete,
        preferred_translation: user.preferred_translation,
        language: user.language,
        timezone: user.timezone,
      },
      token,
    });

    response.cookies.set('auth_token', token, AUTH_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    return serverError(error, 'Login failed');
  }
}
