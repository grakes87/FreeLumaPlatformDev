import { SignJWT, jwtVerify } from 'jose';

export interface JWTPayload {
  id: number;
  email: string;
}

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(jwtSecret);
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ id: payload.id, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export function setAuthCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `auth_token=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${THIRTY_DAYS}`;
}

export function clearAuthCookie(): string {
  return 'auth_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}

/** Cookie options for use with NextResponse.cookies.set() */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: THIRTY_DAYS,
  secure: process.env.NODE_ENV === 'production',
};
