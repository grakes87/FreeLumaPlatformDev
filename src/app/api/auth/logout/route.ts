import { successResponse, serverError } from '@/lib/utils/api';

export async function POST() {
  try {
    const response = successResponse({ message: 'Logged out' });
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return serverError(error, 'Logout failed');
  }
}
