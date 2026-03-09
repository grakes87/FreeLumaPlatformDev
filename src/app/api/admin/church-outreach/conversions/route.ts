import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const createConversionSchema = z.object({
  churchId: z.number().int().positive(),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullish(),
  estimatedSize: z.number().int().positive().nullish(),
  revenueEstimate: z.number().positive().nullish(),
  notes: z.string().nullish(),
});

/**
 * GET /api/admin/church-outreach/conversions - List all conversions
 *
 * Returns conversions with church name, cursor pagination, ordered by order_date DESC.
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { ChurchConversion, Church } = await import('@/lib/db/models');
    const { Op } = await import('sequelize');

    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 100);

    const where: Record<string, unknown> = {};
    if (cursor) {
      where.id = { [Op.lt]: Number(cursor) };
    }

    const conversions = await ChurchConversion.findAll({
      where,
      include: [
        {
          model: Church,
          as: 'church',
          attributes: ['id', 'name', 'pipeline_stage', 'city', 'state'],
        },
      ],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = conversions.length > limit;
    const results = hasMore ? conversions.slice(0, limit) : conversions;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return successResponse({ conversions: results, nextCursor });
  } catch (error) {
    return serverError(error, 'Failed to fetch conversions');
  }
});

/**
 * POST /api/admin/church-outreach/conversions - Create a conversion
 *
 * Creates a conversion record (unique per church -- 409 if already converted).
 * Updates church pipeline_stage to 'converted'.
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = createConversionSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues.map((e: { message: string }) => e.message).join(', '));
    }

    const { churchId, orderDate, estimatedSize, revenueEstimate, notes } = parsed.data;

    const { ChurchConversion, Church, ChurchActivity } = await import('@/lib/db/models');

    // Verify church exists
    const church = await Church.findByPk(churchId);
    if (!church) {
      return errorResponse('Church not found', 404);
    }

    // Check for existing conversion (unique constraint on church_id)
    const existing = await ChurchConversion.findOne({ where: { church_id: churchId } });
    if (existing) {
      return errorResponse('Church has already been converted', 409);
    }

    // Create conversion record
    const conversion = await ChurchConversion.create({
      church_id: churchId,
      order_date: orderDate ?? null,
      estimated_size: estimatedSize ?? null,
      revenue_estimate: revenueEstimate ?? null,
      notes: notes ?? null,
      created_by: context.user.id,
    });

    // Update pipeline stage to 'converted'
    await church.update({ pipeline_stage: 'converted' });

    // Log activity
    await ChurchActivity.create({
      church_id: churchId,
      activity_type: 'converted',
      description: `Church converted! Estimated size: ${estimatedSize ?? 'N/A'}, Revenue: $${revenueEstimate ?? 'N/A'}`,
      metadata: {
        conversion_id: conversion.id,
        order_date: orderDate ?? null,
        estimated_size: estimatedSize ?? null,
        revenue_estimate: revenueEstimate ?? null,
      },
      admin_id: context.user.id,
    });

    return successResponse(conversion, 201);
  } catch (error) {
    return serverError(error, 'Failed to create conversion');
  }
});
