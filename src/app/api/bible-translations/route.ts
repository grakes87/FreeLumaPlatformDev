import { NextRequest } from 'next/server';
import { BibleTranslation } from '@/lib/db/models';
import { successResponse, serverError } from '@/lib/utils/api';

export async function GET(req: NextRequest) {
  try {
    const language = req.nextUrl.searchParams.get('language');

    const where: Record<string, unknown> = { active: true };
    if (language) {
      where.language = language;
    }

    const translations = await BibleTranslation.findAll({
      attributes: ['code', 'name', 'language'],
      where,
      order: [['name', 'ASC']],
    });

    return successResponse(translations);
  } catch (error) {
    return serverError(error, 'Failed to fetch Bible translations');
  }
}
