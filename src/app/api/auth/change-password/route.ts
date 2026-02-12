import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { hashPassword, comparePassword } from '@/lib/auth/password';
import { User } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const body = await req.json();
      const parsed = changePasswordSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { current_password, new_password } = parsed.data;

      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'password_hash'],
      });

      if (!user || !user.password_hash) {
        return errorResponse(
          'Cannot change password for accounts without a password (e.g., social login). Set a password via forgot password flow.',
          400
        );
      }

      // Verify current password
      const isValid = await comparePassword(current_password, user.password_hash);
      if (!isValid) {
        return errorResponse('Current password is incorrect.', 400);
      }

      // Hash and update new password
      const passwordHash = await hashPassword(new_password);
      await user.update({ password_hash: passwordHash });

      return successResponse({ message: 'Password changed successfully.' });
    } catch (error) {
      return serverError(error, 'Failed to change password');
    }
  }
);
