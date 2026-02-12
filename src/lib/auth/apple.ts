import appleSignin from 'apple-signin-auth';

interface AppleUserInfo {
  email: string;
  name: string | null;
  appleId: string;
}

/**
 * Verifies an Apple identity token using Apple's public keys.
 * Apple only returns the user's name on the FIRST authorization;
 * subsequent logins only provide the identity token with email and sub.
 *
 * @param identityToken - The identity token from Apple Sign-In
 * @param userName - Optional user name (only available on first authorization)
 */
export async function verifyAppleToken(
  identityToken: string,
  userName?: { firstName?: string; lastName?: string } | null
): Promise<AppleUserInfo> {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('APPLE_CLIENT_ID environment variable is not set');
  }

  // Verify the identity token with Apple's public keys
  const payload = await appleSignin.verifyIdToken(identityToken, {
    audience: clientId,
    ignoreExpiration: false,
  });

  if (!payload.sub) {
    throw new Error('Invalid Apple token: no subject (sub) claim');
  }

  // Build the name from the user info (only available on first auth)
  let name: string | null = null;
  if (userName?.firstName || userName?.lastName) {
    name = [userName.firstName, userName.lastName].filter(Boolean).join(' ');
  }

  // Apple may provide email or use a relay address
  const email = payload.email || '';

  return {
    email,
    name,
    appleId: payload.sub,
  };
}
