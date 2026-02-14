import { RtcTokenBuilder, RtcRole } from 'agora-token';

/**
 * Generate a time-limited Agora RTC token with role-based privileges.
 *
 * @param channelName - The Agora channel name (e.g., "workshop-123")
 * @param uid - Numeric user ID for the token (must be unique per channel participant)
 * @param role - 'host' maps to PUBLISHER (video+audio), 'audience' maps to SUBSCRIBER (receive-only)
 * @returns An Agora RTC token string valid for 1 hour
 */
export function generateAgoraToken(
  channelName: string,
  uid: number,
  role: 'host' | 'audience'
): string {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId) {
    throw new Error(
      'AGORA_APP_ID environment variable is not set. ' +
        'Get your App ID from the Agora Console: https://console.agora.io'
    );
  }

  if (!appCertificate) {
    throw new Error(
      'AGORA_APP_CERTIFICATE environment variable is not set. ' +
        'Enable and copy your App Certificate from the Agora Console.'
    );
  }

  const agoraRole =
    role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  // Token and privilege both expire in 1 hour (3600 seconds)
  const tokenExpire = 3600;
  const privilegeExpire = 3600;

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    agoraRole,
    tokenExpire,
    privilegeExpire
  );
}
