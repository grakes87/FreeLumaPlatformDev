import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT, type JWTPayload } from './jwt';

export interface AuthContext {
  params: Promise<Record<string, string>>;
  user: JWTPayload;
  /** Raw JWT token (for forwarding to Socket.IO) */
  token: string;
}

type AuthHandler = (
  req: NextRequest,
  context: AuthContext
) => Promise<NextResponse>;

type RouteContext = { params: Promise<Record<string, string>> };

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest, context: RouteContext): Promise<NextResponse> => {
    const cookieStore = await cookies();
    let token = cookieStore.get('auth_token')?.value;

    // Fallback: check Authorization header
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await verifyJWT(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return handler(req, { ...context, user, token });
  };
}

/**
 * Optional auth middleware: if token exists, verify and inject user.
 * If no token or invalid, user is null (no 401).
 */
export interface OptionalAuthContext {
  params: Promise<Record<string, string>>;
  user: JWTPayload | null;
}

type OptionalAuthHandler = (
  req: NextRequest,
  context: OptionalAuthContext
) => Promise<NextResponse>;

export function withOptionalAuth(handler: OptionalAuthHandler) {
  return async (req: NextRequest, context: RouteContext): Promise<NextResponse> => {
    const cookieStore = await cookies();
    let token = cookieStore.get('auth_token')?.value;

    // Fallback: check Authorization header
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    let user: JWTPayload | null = null;
    if (token) {
      user = await verifyJWT(token);
    }

    return handler(req, { ...context, user });
  };
}

/**
 * Admin-only middleware: wraps withAuth and additionally checks
 * that the authenticated user has is_admin === true in the database.
 */
export function withAdmin(handler: AuthHandler) {
  return withAuth(async (req: NextRequest, context: AuthContext) => {
    // Lazy-import to avoid circular dependency at module init
    const { User } = await import('@/lib/db/models');

    const dbUser = await User.findByPk(context.user.id, {
      attributes: ['id', 'is_admin'],
    });

    if (!dbUser || !dbUser.is_admin) {
      return NextResponse.json(
        { error: 'Forbidden: admin access required' },
        { status: 403 }
      );
    }

    return handler(req, context);
  });
}
