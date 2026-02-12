import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT, type JWTPayload } from './jwt';

export interface AuthContext {
  params: Promise<Record<string, string>>;
  user: JWTPayload;
}

type AuthHandler = (
  req: NextRequest,
  context: AuthContext
) => Promise<NextResponse>;

type RouteContext = { params: Promise<Record<string, string>> };

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest, context: RouteContext): Promise<NextResponse> => {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

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
