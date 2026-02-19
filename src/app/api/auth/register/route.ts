import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { sequelize, User, ActivationCode, UserSetting } from '@/lib/db/models';
import { registerSchema } from '@/lib/utils/validation';
import { hashPassword } from '@/lib/auth/password';
import { signJWT, AUTH_COOKIE_OPTIONS } from '@/lib/auth/jwt';
import { registrationRateLimit } from '@/lib/utils/rate-limit';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { AVATAR_COLORS } from '@/lib/utils/constants';

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIP(req);
    const rateLimitResult = registrationRateLimit(ip);
    if (!rateLimitResult.success) {
      return errorResponse('Too many registration attempts. Please try again later.', 429);
    }

    const body = await req.json();

    // Validate input
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return errorResponse(firstError?.message || 'Invalid input', 400);
    }

    const { email, password, display_name, username, activation_code, date_of_birth } = parsed.data;
    const requestedMode = body.mode === 'positivity' ? 'positivity' : body.mode === 'bible' ? 'bible' : null;
    const requestedTranslation = typeof body.preferred_translation === 'string' ? body.preferred_translation.trim() : null;
    const requestedLanguage = body.language === 'es' ? 'es' : 'en';
    const requestedTimezone = typeof body.timezone === 'string' ? body.timezone.trim() : null;
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    type TxError = { error: string; status: number };
    type TxSuccess = { user: InstanceType<typeof User> };

    // Use a transaction for the entire registration
    const result: TxError | TxSuccess = await sequelize.transaction(async (t) => {
      // Check activation code validity
      const activationCode = await ActivationCode.findOne({
        where: {
          code: activation_code,
          status: 'pending',
          expires_at: { [Op.gt]: new Date() },
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!activationCode) {
        return { error: 'Invalid or expired activation code', status: 400 } as TxError;
      }

      // Check email uniqueness
      const existingEmail = await User.findOne({
        where: { email: normalizedEmail },
        paranoid: false,
        transaction: t,
      });
      if (existingEmail) {
        return { error: 'Email already registered', status: 409 } as TxError;
      }

      // Check username uniqueness
      const existingUsername = await User.findOne({
        where: { username: normalizedUsername },
        paranoid: false,
        transaction: t,
      });
      if (existingUsername) {
        return { error: 'Username already taken', status: 409 } as TxError;
      }

      // Hash password
      const password_hash = await hashPassword(password);

      // Random avatar color
      const avatar_color =
        AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

      // User's selection takes precedence, then activation code hint, then default
      const userMode = requestedMode || (activationCode.mode_hint === 'positivity' ? 'positivity' : 'bible');
      const user = await User.create(
        {
          email: normalizedEmail,
          password_hash,
          display_name,
          username: normalizedUsername,
          avatar_color,
          date_of_birth: date_of_birth || null,
          mode: userMode,
          preferred_translation: requestedTranslation || 'KJV',
          language: requestedLanguage,
          timezone: requestedTimezone || 'America/New_York',
          onboarding_complete: false,
        },
        { transaction: t }
      );

      // Atomically mark activation code as used
      const [affectedRows] = await ActivationCode.update(
        { used: true, used_by: user.id, status: 'activated' as const, used_at: new Date() },
        {
          where: {
            id: activationCode.id,
            status: 'pending',
          },
          transaction: t,
        }
      );

      if (affectedRows === 0) {
        throw new Error('ACTIVATION_CODE_RACE');
      }

      // Create user settings with defaults (sync timezone for reminder scheduling)
      await UserSetting.create(
        {
          user_id: user.id,
          reminder_timezone: requestedTimezone || 'America/New_York',
        },
        { transaction: t }
      );

      return { user } as TxSuccess;
    });

    // Handle transaction result
    if ('error' in result) {
      return errorResponse(result.error, result.status);
    }

    const { user } = result;

    // Sign JWT
    const token = await signJWT({ id: user.id, email: user.email });

    // Build response (include token for Socket.IO auth fallback)
    const response = successResponse(
      {
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
          onboarding_complete: user.onboarding_complete,
          preferred_translation: user.preferred_translation,
          language: user.language,
          timezone: user.timezone,
        },
        token,
      },
      201
    );

    response.cookies.set('auth_token', token, AUTH_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'ACTIVATION_CODE_RACE') {
      return errorResponse('Activation code already used', 409);
    }
    return serverError(error, 'Registration failed');
  }
}
