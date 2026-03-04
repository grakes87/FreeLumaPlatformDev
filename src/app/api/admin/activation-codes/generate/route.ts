import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/auth/middleware';
import { ActivationCode } from '@/lib/db/models';
import { Op } from 'sequelize';
import crypto from 'crypto';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

async function generateUniqueCodes(count: number): Promise<string[]> {
  const codes: Set<string> = new Set();
  const maxAttempts = count * 10;
  let attempts = 0;

  while (codes.size < count && attempts < maxAttempts) {
    codes.add(generateCode());
    attempts++;
  }

  const codeArray = Array.from(codes);
  const existing = await ActivationCode.findAll({
    where: { code: { [Op.in]: codeArray } },
    attributes: ['code'],
  });

  const existingCodes = new Set(existing.map((c) => c.code));
  const uniqueCodes = codeArray.filter((c) => !existingCodes.has(c));

  while (uniqueCodes.length < count && attempts < maxAttempts) {
    const newCode = generateCode();
    if (!existingCodes.has(newCode) && !uniqueCodes.includes(newCode)) {
      uniqueCodes.push(newCode);
    }
    attempts++;
  }

  return uniqueCodes.slice(0, count);
}

/**
 * GET /api/admin/activation-codes/generate?count=10
 *
 * Generates activation codes with status 'pending'.
 * Callable from a browser — just visit the URL while logged in as admin.
 */
export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const countParam = searchParams.get('count');
    const count = countParam ? parseInt(countParam, 10) : 0;

    if (!count || count < 1 || count > 500) {
      return NextResponse.json(
        { error: 'count query param required (1-500)' },
        { status: 400 }
      );
    }

    const codes = await generateUniqueCodes(count);

    if (codes.length < count) {
      return NextResponse.json(
        { error: 'Failed to generate enough unique codes. Please try again.' },
        { status: 500 }
      );
    }

    const expiresAt = new Date('9999-12-31');

    const records = codes.map((code) => ({
      code,
      mode_hint: null,
      expires_at: expiresAt,
      status: 'pending' as const,
      created_by: null,
    }));

    await ActivationCode.bulkCreate(records);

    return NextResponse.json({
      count: codes.length,
      codes,
    });
  } catch (error) {
    console.error('Generate activation codes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
