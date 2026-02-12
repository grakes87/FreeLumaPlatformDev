import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdmin } from '@/lib/auth/middleware';
import { ActivationCode } from '@/lib/db/models';
import { Op } from 'sequelize';
import crypto from 'crypto';

// Characters that avoid confusion (no O/0/I/l)
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

  // Verify none already exist in DB
  const codeArray = Array.from(codes);
  const existing = await ActivationCode.findAll({
    where: { code: { [Op.in]: codeArray } },
    attributes: ['code'],
  });

  const existingCodes = new Set(existing.map((c) => c.code));
  const uniqueCodes = codeArray.filter((c) => !existingCodes.has(c));

  // If collisions occurred, generate replacements
  while (uniqueCodes.length < count && attempts < maxAttempts) {
    const newCode = generateCode();
    if (!existingCodes.has(newCode) && !uniqueCodes.includes(newCode)) {
      uniqueCodes.push(newCode);
    }
    attempts++;
  }

  return uniqueCodes.slice(0, count);
}

// POST: Generate activation codes in bulk
const postSchema = z.object({
  count: z.number().int().min(1).max(100),
  mode_hint: z.enum(['bible', 'positivity']).optional(),
  expires_in_days: z.number().int().min(1).max(3650).optional().default(365),
});

export const POST = withAdmin(async (req: NextRequest, context) => {
  try {
    const body = await req.json();
    const result = postSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { count, mode_hint, expires_in_days } = result.data;

    const codes = await generateUniqueCodes(count);

    if (codes.length < count) {
      return NextResponse.json(
        { error: 'Failed to generate enough unique codes. Please try again.' },
        { status: 500 }
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    const records = codes.map((code) => ({
      code,
      mode_hint: mode_hint ?? null,
      expires_at: expiresAt,
      created_by: context.user.id,
    }));

    await ActivationCode.bulkCreate(records);

    return NextResponse.json(
      { codes, count: codes.length },
      { status: 201 }
    );
  } catch (error) {
    console.error('Admin activation codes POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// GET: List activation codes with stats
const getQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  used: z.enum(['true', 'false']).optional(),
});

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const result = getQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      used: searchParams.get('used') ?? undefined,
    });

    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { page, limit, used } = result.data;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (used === 'true') where.used = true;
    if (used === 'false') where.used = false;

    const { rows: codes, count: total } = await ActivationCode.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    // Get usage stats
    const usedCount = await ActivationCode.count({ where: { used: true } });
    const unusedCount = await ActivationCode.count({ where: { used: false } });

    return NextResponse.json({
      codes,
      total,
      used_count: usedCount,
      unused_count: unusedCount,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Admin activation codes GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
