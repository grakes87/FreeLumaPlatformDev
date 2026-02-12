import { NextRequest } from 'next/server';
import { successResponse, serverError } from '@/lib/utils/api';

export async function GET(_req: NextRequest) {
  try {
    const { Category } = await import('@/lib/db/models');

    const categories = await Category.findAll({
      where: { active: true },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
      attributes: ['id', 'name', 'slug', 'description', 'icon', 'sort_order'],
    });

    return successResponse({ categories });
  } catch (error) {
    return serverError(error, 'Failed to fetch categories');
  }
}
