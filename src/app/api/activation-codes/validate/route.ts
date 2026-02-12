import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { ActivationCode } from '@/lib/db/models';
import { activationCodeSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = activationCodeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Invalid activation code format', 400);
    }

    const { code } = parsed.data;

    const activation = await ActivationCode.findOne({
      where: {
        code,
        used: false,
        expires_at: { [Op.gt]: new Date() },
      },
    });

    if (!activation) {
      return errorResponse('Invalid or expired activation code', 400);
    }

    return successResponse({
      valid: true,
      mode_hint: activation.mode_hint,
    });
  } catch (error) {
    return serverError(error, 'Failed to validate activation code');
  }
}
