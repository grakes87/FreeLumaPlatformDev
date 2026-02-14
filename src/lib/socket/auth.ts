import { parse as parseCookie } from 'cookie';
import { verifyJWT } from '@/lib/auth/jwt';
import type { Socket, ExtendedError } from 'socket.io';

/**
 * Socket.IO auth middleware that extracts the JWT from either:
 * 1. The `auth.token` option passed by the client (primary, reliable)
 * 2. The HTTP cookie header (fallback)
 *
 * On success, attaches userId and email to socket.data.
 */
export async function authMiddleware(
  socket: Socket,
  next: (err?: ExtendedError) => void
): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check auth option (passed by Socket.IO client)
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      token = authToken;
    }

    // 2. Fallback: check cookie header
    if (!token) {
      const cookieHeader = socket.handshake.headers.cookie;
      if (cookieHeader) {
        const cookies = parseCookie(cookieHeader);
        token = cookies.auth_token;
      }
    }

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return next(new Error('Authentication failed: invalid token'));
    }

    socket.data.userId = payload.id;
    socket.data.email = payload.email;
    next();
  } catch {
    next(new Error('Authentication failed'));
  }
}
