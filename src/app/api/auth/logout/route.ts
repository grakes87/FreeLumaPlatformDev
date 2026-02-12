import { clearAuthCookie } from '@/lib/auth/jwt';
import { successResponse, serverError } from '@/lib/utils/api';

export async function POST() {
  try {
    const response = successResponse({ message: 'Logged out' });
    response.headers.set('Set-Cookie', clearAuthCookie());
    return response;
  } catch (error) {
    return serverError(error, 'Logout failed');
  }
}
