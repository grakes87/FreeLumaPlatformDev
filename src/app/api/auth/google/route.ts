import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { sequelize, User, ActivationCode, UserSetting } from '@/lib/db/models';
import { verifyGoogleCredential } from '@/lib/auth/google';
import { signJWT, setAuthCookie } from '@/lib/auth/jwt';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { AVATAR_COLORS } from '@/lib/utils/constants';

export async function POST(req: NextRequest) {
  try {
    // Check if Google OAuth is configured
    if (!process.env.GOOGLE_CLIENT_ID) {
      return errorResponse('Google Sign-In is not configured', 503);
    }

    const body = await req.json();
    const { credential, activation_code } = body;

    if (!credential) {
      return errorResponse('Missing Google credential', 400);
    }

    // Verify the Google credential server-side
    let googleUser;
    try {
      googleUser = await verifyGoogleCredential(credential);
    } catch (err) {
      console.error('[Google Auth] Token verification failed:', err);
      return errorResponse('Invalid Google credential', 401);
    }

    const { email, name, picture, googleId } = googleUser;
    const normalizedEmail = email.toLowerCase().trim();

    // Try to find user by google_id first
    let user = await User.findOne({
      where: { google_id: googleId },
    });

    if (user) {
      // Existing user with google_id linked -- login flow
      await user.update({ last_login_at: new Date() });

      const token = await signJWT({ id: user.id, email: user.email });
      const response = successResponse({
        user: buildUserResponse(user),
        isNewUser: false,
      });
      response.headers.set('Set-Cookie', setAuthCookie(token));
      return response;
    }

    // Not found by google_id -- check by email
    user = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (user) {
      // Found by email -- link google_id to existing user (account linking)
      await user.update({
        google_id: googleId,
        avatar_url: user.avatar_url || picture,
        last_login_at: new Date(),
      });

      const token = await signJWT({ id: user.id, email: user.email });
      const response = successResponse({
        user: buildUserResponse(user),
        isNewUser: false,
      });
      response.headers.set('Set-Cookie', setAuthCookie(token));
      return response;
    }

    // Not found at all -- new user signup. Activation code required.
    if (!activation_code) {
      return errorResponse(
        'Activation code required for new accounts',
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

      // Generate a temporary username from email prefix
      const emailPrefix = normalizedEmail.split('@')[0].replace(/[^a-z0-9_]/g, '');
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
          google_id: googleId,
          display_name: name,
          username: tempUsername,
          avatar_url: picture,
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
      },
      201
    );
    response.headers.set('Set-Cookie', setAuthCookie(token));
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'ACTIVATION_CODE_RACE') {
      return errorResponse('Activation code already used', 409);
    }
    return serverError(error, 'Google authentication failed');
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
