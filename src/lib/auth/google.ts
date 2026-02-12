import { OAuth2Client } from 'google-auth-library';

interface GoogleUserInfo {
  email: string;
  name: string;
  picture: string | null;
  googleId: string;
}

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!client) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is not set');
    }
    client = new OAuth2Client(clientId);
  }
  return client;
}

/**
 * Verifies a Google ID token (credential) returned by @react-oauth/google.
 * Returns the user's email, name, profile picture, and Google user ID.
 */
export async function verifyGoogleCredential(
  credential: string
): Promise<GoogleUserInfo> {
  const oauth2Client = getClient();

  const ticket = await oauth2Client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google credential: no payload');
  }

  if (!payload.email) {
    throw new Error('Invalid Google credential: no email in payload');
  }

  return {
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || null,
    googleId: payload.sub,
  };
}
