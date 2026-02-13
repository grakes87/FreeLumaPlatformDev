import { parse as parseCookie } from 'cookie';
import { verifyJWT } from '@/lib/auth/jwt';
import type { Socket, ExtendedError } from 'socket.io';

/**
 * Socket.IO auth middleware that extracts auth_token from the HTTP cookie
 * and verifies the JWT. On success, attaches userId and email to socket.data.
 */
export async function authMiddleware(
  socket: Socket,
  next: (err?: ExtendedError) => void
): Promise<void> {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      return next(new Error('Authentication required: no cookie'));
    }

    const cookies = parseCookie(cookieHeader);
    const token = cookies.auth_token;
    if (!token) {
      return next(new Error('Authentication required: no auth_token'));
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
