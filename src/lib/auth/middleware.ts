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
