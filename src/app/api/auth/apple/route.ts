import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { sequelize, User, ActivationCode, UserSetting, Ban } from '@/lib/db/models';
import { verifyAppleToken } from '@/lib/auth/apple';
import { signJWT, AUTH_COOKIE_OPTIONS } from '@/lib/auth/jwt';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { AVATAR_COLORS } from '@/lib/utils/constants';

/**
 * Check user account status and handle reactivation/ban for OAuth login.
 * Returns an error response if login should be blocked, or null if OK to proceed.
 */
async function handleAccountStatus(user: InstanceType<typeof User>): Promise<import('next/server').NextResponse | null> {
  if (user.status === 'banned') {
    const activeBan = await Ban.findOne({
      where: { user_id: user.id, lifted_at: null },
      order: [['created_at', 'DESC']],
    });

    if (activeBan && (activeBan.expires_at === null || new Date(activeBan.expires_at) > new Date())) {
      return errorResponse('Account suspended', 403);
    }

    // Ban expired or no active ban — auto-unban
    if (activeBan) {
      await activeBan.update({ lifted_at: new Date() });
    }
    await user.update({ status: 'active' });
  } else if (user.status === 'deactivated') {
    await user.update({ status: 'active', deactivated_at: null });
  } else if (user.status === 'pending_deletion') {
    await user.update({ status: 'active', deletion_requested_at: null });
  }

  return null; // OK to proceed
}

export async function POST(req: NextRequest) {
  try {
    // Check if Apple OAuth is configured
    if (!process.env.APPLE_CLIENT_ID) {
      return errorResponse('Apple Sign-In is not configured', 503);
    }

    const body = await req.json();
    const { identityToken, user: appleUserInfo, activation_code } = body;

    if (!identityToken) {
      return errorResponse('Missing Apple identity token', 400);
    }

    // Verify the Apple identity token server-side
    let appleUser;
    try {
      appleUser = await verifyAppleToken(
        identityToken,
        appleUserInfo?.name || null
      );
    } catch (err) {
      console.error('[Apple Auth] Token verification failed:', err);
      return errorResponse('Invalid Apple identity token', 401);
    }

    const { email, name, appleId } = appleUser;

    // Try to find user by apple_id first
    let user = await User.findOne({
      where: { apple_id: appleId },
    });

    if (user) {
      // Existing user with apple_id linked -- login flow
      // Check account status before allowing login
      const statusBlock = await handleAccountStatus(user);
      if (statusBlock) return statusBlock;

      await user.update({ last_login_at: new Date() });

      const token = await signJWT({ id: user.id, email: user.email });
      const response = successResponse({
        user: buildUserResponse(user),
        isNewUser: false,
        token,
      });
      response.cookies.set('auth_token', token, AUTH_COOKIE_OPTIONS);
      return response;
    }

    // Apple may use relay email (Hide My Email) or real email
    const normalizedEmail = email ? email.toLowerCase().trim() : '';

    // Not found by apple_id -- check by email if available
    if (normalizedEmail) {
      user = await User.findOne({
        where: { email: normalizedEmail },
      });

      if (user) {
        // Found by email -- link apple_id to existing user (account linking)
        // Check account status before allowing login
        const statusBlock = await handleAccountStatus(user);
        if (statusBlock) return statusBlock;

        await user.update({
          apple_id: appleId,
          last_login_at: new Date(),
        });

        const token = await signJWT({ id: user.id, email: user.email });
        const response = successResponse({
          user: buildUserResponse(user),
          isNewUser: false,
          token,
        });
        response.cookies.set('auth_token', token, AUTH_COOKIE_OPTIONS);
        return response;
      }
    }

    // Not found at all -- new user signup. Activation code required.
    if (!activation_code) {
      return errorResponse(
        'Activation code required for new accounts',
        400
      );
    }

    if (!normalizedEmail) {
      return errorResponse(
        'Email is required for new account creation. Please share your email with Apple Sign-In.',
        400
      );
    }

    // Create new user inside a transaction
    type TxError = { error: string; status: number };
    type TxSuccess = { user: InstanceType<typeof User> };

    const result: TxError | TxSuccess = await sequelize.transaction(async (t) => {
      // Validate activation code
      const activationCode = await ActivationCode.findOne({
        where: {
          code: activation_code,
          used: false,
          expires_at: { [Op.gt]: new Date() },
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!activationCode) {
        return {
          error: 'Invalid or expired activation code',
          status: 400,
        } as TxError;
      }

      // Check email uniqueness
      const existingEmail = await User.findOne({
        where: { email: normalizedEmail },
        paranoid: false,
        transaction: t,
      });
      if (existingEmail) {
        return {
          error: 'Email already registered',
          status: 409,
        } as TxError;
      }

      // Generate a temporary username from email or name
      const displayName = name || normalizedEmail.split('@')[0];
      const emailPrefix = normalizedEmail
        .split('@')[0]
        .replace(/[^a-z0-9_]/g, '');
      let tempUsername = emailPrefix.slice(0, 25) || 'user';

      // Ensure username uniqueness
      const existingUsername = await User.findOne({
        where: { username: tempUsername },
        paranoid: false,
        transaction: t,
      });
      if (existingUsername) {
        tempUsername = `${tempUsername}_${Date.now().toString(36).slice(-4)}`;
      }

      const avatarColor =
        AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

      const newUser = await User.create(
        {
          email: normalizedEmail,
          apple_id: appleId,
          display_name: displayName,
          username: tempUsername,
          avatar_color: avatarColor,
          onboarding_complete: false,
        },
        { transaction: t }
      );

      // Atomically mark activation code
      const [affectedRows] = await ActivationCode.update(
        { used: true, used_by: newUser.id },
        {
          where: { id: activationCode.id, used: false },
          transaction: t,
        }
      );

      if (affectedRows === 0) {
        throw new Error('ACTIVATION_CODE_RACE');
      }

      // Create user settings
      await UserSetting.create(
        { user_id: newUser.id },
        { transaction: t }
      );

      return { user: newUser } as TxSuccess;
    });

    if ('error' in result) {
      return errorResponse(result.error, result.status);
    }

    const newUser = result.user;
    const token = await signJWT({ id: newUser.id, email: newUser.email });
    const response = successResponse(
      {
        user: buildUserResponse(newUser),
        isNewUser: true,
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
    return serverError(error, 'Apple authentication failed');
  }
}

function buildUserResponse(user: InstanceType<typeof User>) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    username: user.username,
    avatar_url: user.avatar_url,
    avatar_color: user.avatar_color,
    mode: user.mode,
    onboarding_complete: user.onboarding_complete,
    is_admin: user.is_admin,
    preferred_translation: user.preferred_translation,
    language: user.language,
    timezone: user.timezone,
  };
}
